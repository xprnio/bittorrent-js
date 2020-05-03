class BepParser {
  parseNext(data, offset, state, callback) {
    const char = String.fromCharCode(data[offset]);
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
        return callback('Invalid data');
      }

      return this.queueNext(data, offset, state, callback);
    }

    switch (current.type) {
      case 'string': {
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
              parent.value[current.parent] = current.value;
            } else if (parent.type === 'dictionary') {
              const kvp = parent.value[current.parent];
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
      case 'integer': {
        if (current.value === null) current.value = '';

        if (char === 'e') {
          if(current.value === '-0') return callback(new Error(`Invalid integer ${current.value}: negative zero`));
          if (current.value.match(/^-?0\d+$/)) {
            return callback(new Error(`Invalid integer ${current.value}: leading zero`));
          }

          current.value = +current.value;
          if (parent) {
            if (parent.type === 'list') {
              parent.value[current.parent] = current.value;
            } else if (parent.type === 'dictionary') {
              const kvp = parent.value[current.parent];
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

        current.value += char;

        return this.queueNext(data, offset + 1, state, callback);
      }
      case 'list': {
        if (current.value === null) {
          current.value = [];
        }

        if (char === 'e') {
          if (parent) {
            if (parent.type === 'list') {
              parent.value[current.parent] = current.value;
            } else if (parent.type === 'dictionary') {
              const kvp = parent.value[current.parent];
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
          parent: current.value.length,
        });
        return this.queueNext(data, offset, state, callback);
      }
      case 'dictionary': {
        if (current.value === null) {
          current.value = [];
        }

        if (char === 'e') {
          const dictionary = {};

          for (let i = 0; i < current.value.length; i++) {
            const kvp = current.value[i];
            dictionary[kvp.key] = kvp.value;
          }

          current.value = dictionary;

          if (parent) {
            if(parent.type === 'dictionary') {
              const kvp = parent.value[current.parent];
              if (!kvp.key) {
                return callback(new Error('Invalid data: dictionary cannot be a dictionary key'));
              } else if (!kvp.value) {
                kvp.value = current.value;
              } else {
                return callback(new Error('Key value pair already filled'));
              }
            } else {
              parent.value[current.parent] = current.value;
            }
          } else {
            state.value = current.value;
          }
          state.queue.pop();
          return this.queueNext(data, offset + 1, state, callback);
        }

        if (current.value.length === 0) {
          current.value.push({ key: null, value: null });
        }

        const kvp = current.value[current.value.length - 1];

        if (kvp.key && kvp.value) {
          current.value.push({
            key: null,
            value: null,
          });
        }

        state.queue.push({
          type: null,
          value: null,
          length: null,
          parent: current.value.length - 1,
        });

        return this.queueNext(data, offset, state, callback);
      }
    }

    callback(new Error('Not implemented'));
  }

  queueNext(data, offset, state, callback) {
    setTimeout(() => this.parseNext(data, offset, state, callback), 0);
  }

  async parse(data) {
    const state = {
      queue: [{
        type: null,
        value: null,
        length: null,
        parent: null,
      }],
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

module.exports = { BepParser };
