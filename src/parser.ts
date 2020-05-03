import {
  BepList,
  KeyValuePair,
  ParserCallback,
  ParserDictionaryItem,
  ParserIntegerItem,
  ParserListItem,
  ParserState,
  ParserStringItem,
  ParserValue,
} from './parser.types';

export class BepParser {
  async parse(data): Promise<ParserValue> {
    const state: ParserState = {
      queue: [ {
        type: null,
        value: null,
        length: null,
        parent: null,
      } ],
      value: null,
    };
    return new Promise((resolve, reject) => {
      this.parseNext(data, 0, state, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private parseNext(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    const char: string = String.fromCharCode(data[offset]);
    const current = state.queue[state.queue.length - 1];

    if (offset >= data.length) return callback(null, state.value);

    if (!current.type) {
      if (!isNaN(+char)) {
        current.type = 'string';
      } else {
        if (char === 'i') current.type = 'integer';
        if (char === 'l') current.type = 'list';
        if (char === 'd') current.type = 'dictionary';
        offset += 1;
      }

      if (!current.type) {
        return callback(new Error('Invalid data'));
      }

      return this.queueNext(data, offset, state, callback);
    }

    switch (current.type) {
      case 'string':
        return this.handleString(data, offset, state, callback);
      case 'integer':
        return this.handleInteger(data, offset, state, callback);
      case 'list':
        return this.handleList(data, offset, state, callback);
      case 'dictionary':
        return this.handleDictionary(data, offset, state, callback);
      default:
        callback(new Error(`Invalid type: ${ current.type }`));
    }
  }

  private queueNext(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    setTimeout(() => this.parseNext(data, offset, state, callback), 0);
  }

  private handleString(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    const current = state.queue[state.queue.length - 1] as ParserStringItem;
    const parent = state.queue[state.queue.length - 2];
    const char = String.fromCharCode(data[offset]);

    if (current.length === null) current.length = 0;

    if (current.value === null) {
      if (char === ':') current.value = '';
      else current.length = current.length * 10 + parseInt(char);
      return this.queueNext(data, offset + 1, state, callback);
    }

    current.value += char;

    if (current.value.length === current.length) {
      if (parent) {
        if (parent.type === 'list') {
          const list = parent.value as BepList;
          list.push(current.value);
        } else if (parent.type === 'dictionary') {
          const dictionary = current.parent as ParserDictionaryItem;
          const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];
          if (!kvp.key) {
            kvp.key = current.value;
          } else if (!kvp.value) {
            kvp.value = current.value;
          } else {
            return callback(new Error('Key value pair already filled'));
          }
        }
      } else {
        state.value = current.value;
      }
      state.queue.pop();
    }

    return this.queueNext(data, offset + 1, state, callback);
  }

  private handleInteger(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    const current = state.queue[state.queue.length - 1] as ParserIntegerItem;
    const parent = state.queue[state.queue.length - 2];
    const char = String.fromCharCode(data[offset]);

    if (!current.stringValue) current.stringValue = '';

    if (char === 'e') {
      if (current.stringValue === '-0') return callback(new Error(`Invalid integer ${ current.stringValue }: negative zero`));
      if (current.stringValue.match(/^-?0\d+$/)) {
        return callback(new Error(`Invalid integer ${ current.stringValue }: leading zero`));
      }

      current.value = +current.stringValue;

      if (parent) {
        if (parent.type === 'list') {
          const list = current.parent as ParserListItem;
          list.value.push(current.value);
        } else if (parent.type === 'dictionary') {
          const dictionary: ParserDictionaryItem = current.parent as ParserDictionaryItem;
          const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];

          if (!kvp.key) {
            return callback(new Error('Invalid data: integer cannot be a dictionary key'));
          } else if (!kvp.value) {
            kvp.value = current.value;
          } else {
            return callback(new Error('Key value pair already filled'));
          }
        }
      } else {
        state.value = current.value;
      }
      state.queue.pop();
      return this.queueNext(data, offset + 1, state, callback);
    }

    current.stringValue += char;

    return this.queueNext(data, offset + 1, state, callback);
  }

  private handleList(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    const current = state.queue[state.queue.length - 1] as ParserListItem;
    const parent = state.queue[state.queue.length - 2];
    const char = String.fromCharCode(data[offset]);

    if (current.value === null) current.value = [];

    if (char === 'e') {
      if (parent) {
        if (parent.type === 'list') {
          const list = parent as ParserListItem;
          list.value.push(current.value);
        } else if (parent.type === 'dictionary') {
          const dictionary = current.parent as ParserDictionaryItem;
          const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];

          if (!kvp.key) {
            return callback(new Error('Invalid data: list cannot be a dictionary key'));
          } else if (!kvp.value) {
            kvp.value = current.value;
          } else {
            return callback(new Error('Key value pair already filled'));
          }
        } else {
          return callback(new Error('Invalid parent'));
        }
      } else {
        state.value = current.value;
      }
      state.queue.pop();
      return this.queueNext(data, offset + 1, state, callback);
    }

    state.queue.push({
      type: null,
      value: null,
      length: null,
      parent: current,
    });
    return this.queueNext(data, offset, state, callback);
  }

  private handleDictionary(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    const current = state.queue[state.queue.length - 1] as ParserDictionaryItem;
    const parent = state.queue[state.queue.length - 2];
    const char = String.fromCharCode(data[offset]);

    if (!current.keyValuePairs) current.keyValuePairs = [];

    if (char === 'e') {
      const dictionary = {};

      for (let i = 0; i < current.keyValuePairs.length; i++) {
        const kvp = current.keyValuePairs[i];
        dictionary[kvp.key] = kvp.value;
      }

      current.value = dictionary;

      if (parent) {
        if (parent.type === 'list') {
          const list = current.parent as ParserListItem;
          list.value.push(current.value);
        } else if (parent.type === 'dictionary') {
          const dictionary = current.parent as ParserDictionaryItem;
          const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];
          if (!kvp.key) {
            return callback(new Error('Invalid data: dictionary cannot be a dictionary key'));
          } else if (!kvp.value) {
            kvp.value = current.value;
          } else {
            return callback(new Error('Key value pair already filled'));
          }
        } else {
          return callback(new Error('Invalid parent'));
        }
      } else {
        state.value = current.value;
      }
      state.queue.pop();
      return this.queueNext(data, offset + 1, state, callback);
    }

    if (current.keyValuePairs.length === 0) {
      current.keyValuePairs.push({ key: null, value: null });
    }

    const kvp = current.keyValuePairs[current.keyValuePairs.length - 1];

    if (kvp.key && kvp.value) {
      current.keyValuePairs.push({
        key: null,
        value: null,
      });
    }

    state.queue.push({
      type: null,
      value: null,
      length: null,
      parent: current,
    });

    return this.queueNext(data, offset, state, callback);
  }
}
