type BepList = Array<any>;
type BepDictionary = { [key: string]: string | number | BepList | BepDictionary };
type ParserValue = null | string | number | BepList | KeyValuePair;
type ParserCallback = (err?: Error, result?: ParserValue) => void;

interface ParserQueueItem {
  type: null | 'string' | 'integer' | 'list' | 'dictionary';
  value: ParserValue;
  length: number | null;
  parent?: ParserListItem | ParserDictionaryItem;
}

interface ParserStringItem {
  type: 'string';
  value: null | string;
  length: number | null;
  parent?: ParserListItem | ParserDictionaryItem;
}

interface ParserIntegerItem {
  type: 'integer';
  stringValue: null | string;
  value: null | number;
  length: null;
  parent?: ParserListItem | ParserDictionaryItem;
}

interface ParserListItem {
  type: 'list';
  value: null | BepList;
  length: null | number;
  parent?: ParserListItem | ParserDictionaryItem;
}

interface ParserDictionaryItem {
  type: 'dictionary';
  keyValuePairs: Array<KeyValuePair>;
  value: null | BepDictionary;
  length: number | null;
  parent?: ParserListItem | ParserDictionaryItem;
}

interface KeyValuePair {
  key?: null | string;
  value?: null | string | number | BepList | KeyValuePair;
}

interface ParserState {
  queue: Array<ParserQueueItem>;
  value: null | ParserValue;
}

export class BepParser {
  handleString() {}

  parseNext(data: Buffer, offset: number, state: ParserState, callback: ParserCallback): void {
    const char: string = String.fromCharCode(data[offset]);
    const current = state.queue[state.queue.length - 1];
    const parent = state.queue[state.queue.length - 2];

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
      case 'string': {
        const item = current as ParserStringItem;

        if (item.length === null) item.length = 0;

        if (item.value === null) {
          if (char === ':') item.value = '';
          else item.length = item.length * 10 + parseInt(char);
          return this.queueNext(data, offset + 1, state, callback);
        }

        item.value += char;

        if (item.value.length === item.length) {
          if (parent) {
            if (parent.type === 'list') {
              const list = parent.value as BepList;
              list.push(item.value);
            } else if (parent.type === 'dictionary') {
              const dictionary = item.parent as ParserDictionaryItem;
              const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];
              if (!kvp.key) {
                kvp.key = item.value;
              } else if (!kvp.value) {
                kvp.value = item.value;
              } else {
                return callback(new Error('Key value pair already filled'));
              }
            }
          } else {
            state.value = item.value;
          }
          state.queue.pop();
        }

        return this.queueNext(data, offset + 1, state, callback);
      }
      case 'integer': {
        const item = current as ParserIntegerItem;

        if (!item.stringValue) item.stringValue = '';

        if (char === 'e') {
          if (item.stringValue === '-0') return callback(new Error(`Invalid integer ${ item.stringValue }: negative zero`));
          if (item.stringValue.match(/^-?0\d+$/)) {
            return callback(new Error(`Invalid integer ${ item.stringValue }: leading zero`));
          }

          item.value = +item.stringValue;

          if (parent) {
            if (parent.type === 'list') {
              const list = item.parent as ParserListItem;
              list.value.push(item.value);
            } else if (parent.type === 'dictionary') {
              const dictionary: ParserDictionaryItem = item.parent as ParserDictionaryItem;
              const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];

              if (!kvp.key) {
                return callback(new Error('Invalid data: integer cannot be a dictionary key'));
              } else if (!kvp.value) {
                kvp.value = item.value;
              } else {
                return callback(new Error('Key value pair already filled'));
              }
            }
          } else {
            state.value = item.value;
          }
          state.queue.pop();
          return this.queueNext(data, offset + 1, state, callback);
        }

        item.stringValue += char;

        return this.queueNext(data, offset + 1, state, callback);
      }
      case 'list': {
        const item = current as ParserListItem;

        if (item.value === null) item.value = [];

        if (char === 'e') {
          if (parent) {
            if (parent.type === 'list') {
              const list = parent as ParserListItem;
              list.value.push(item.value);
            } else if (parent.type === 'dictionary') {
              const dictionary = item.parent as ParserDictionaryItem;
              const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];

              if (!kvp.key) {
                return callback(new Error('Invalid data: list cannot be a dictionary key'));
              } else if (!kvp.value) {
                kvp.value = item.value;
              } else {
                return callback(new Error('Key value pair already filled'));
              }
            } else {
              return callback(new Error('Invalid parent'));
            }
          } else {
            state.value = item.value;
          }
          state.queue.pop();
          return this.queueNext(data, offset + 1, state, callback);
        }

        state.queue.push({
          type: null,
          value: null,
          length: null,
          parent: item,
        });
        return this.queueNext(data, offset, state, callback);
      }
      case 'dictionary': {
        const item = current as ParserDictionaryItem;

        if (!item.keyValuePairs) item.keyValuePairs = [];

        if (char === 'e') {
          const dictionary = {};

          for (let i = 0; i < item.keyValuePairs.length; i++) {
            const kvp = item.keyValuePairs[i];
            dictionary[kvp.key] = kvp.value;
          }

          item.value = dictionary;

          if (parent) {
            if (parent.type === 'list') {
              const list = item.parent as ParserListItem;
              list.value.push(item.value);
            } else if (parent.type === 'dictionary') {
              const dictionary = item.parent as ParserDictionaryItem;
              const kvp: KeyValuePair = dictionary.keyValuePairs[dictionary.keyValuePairs.length - 1];
              if (!kvp.key) {
                return callback(new Error('Invalid data: dictionary cannot be a dictionary key'));
              } else if (!kvp.value) {
                kvp.value = item.value;
              } else {
                return callback(new Error('Key value pair already filled'));
              }
            } else {
              return callback(new Error('Invalid parent'));
            }
          } else {
            state.value = item.value;
          }
          state.queue.pop();
          return this.queueNext(data, offset + 1, state, callback);
        }

        if (item.keyValuePairs.length === 0) {
          item.keyValuePairs.push({ key: null, value: null });
        }

        const kvp = item.keyValuePairs[item.keyValuePairs.length - 1];

        if (kvp.key && kvp.value) {
          item.keyValuePairs.push({
            key: null,
            value: null,
          });
        }

        state.queue.push({
          type: null,
          value: null,
          length: null,
          parent: item,
        });

        return this.queueNext(data, offset, state, callback);
      }
    }

    callback(new Error('Not implemented'));
  }

  queueNext(data: Buffer, offset: number, state: ParserState, callback: ParserCallback) {
    setTimeout(() => this.parseNext(data, offset, state, callback), 0);
  }

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
}
