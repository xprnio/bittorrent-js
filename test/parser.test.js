const { BepParser } = require('../src/parser');

const ascii = (string) => string.split('').map(c => c.charCodeAt(0));
const expectThrowAsync = async (fn, error) => {
  let err;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeDefined();
  expect(() => {
    throw err;
  }).toThrow(error);
};

describe('Parser', () => {
  const parser = new BepParser();

  describe('bencoding', () => {
    describe('string', () => {
      it('should parse string', async () => {
        const data = ascii('4:spam');
        const result = await parser.parse(data);

        expect(result).toBe('spam');
      });
    });

    describe('integer', () => {
      it('should parse negative integer', async () => {
        const data = ascii('i-3e');
        const result = await parser.parse(data);

        expect(result).toBe(-3);
      });
      it('should parse zero', async () => {
        const data = ascii('i0e');
        const result = await parser.parse(data);

        expect(result).toBe(0);
      });
      it('should parse integer', async () => {
        const data = ascii('i3e');
        const result = await parser.parse(data);

        expect(result).toBe(3);
      });
      it('should return error for negative zero', async () => {
        const data = ascii('i-0e');

        await expectThrowAsync(() => parser.parse(data), 'Invalid integer -0: negative zero');
      });
      it('should return error for leading zero', async () => {
        const data = ascii('i03e');

        await expectThrowAsync(() => parser.parse(data), 'Invalid integer 03: leading zero');
      });
    });

    describe('list', () => {
      it('should parse list with one item', async () => {
        const data = ascii('l4:spame');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('length', 1);
        expect(result).toContainEqual('spam');
      });
      it('should parse list with two items', async () => {
        const data = ascii('l4:spami32ee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('length', 2);
        expect(result).toHaveProperty('0', 'spam');
        expect(result).toHaveProperty('1', 32);
      });
      it('should parse nested list with one item', async () => {
        const data = ascii('ll4:spamee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('length', 1);
        expect(result).toHaveProperty('0.length', 1);
        expect(result).toHaveProperty('0.0', 'spam');
      });
      it('should parse two nested lists with one item each', async () => {
        const data = ascii('ll4:spamel4:spamee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('length', 2);

        expect(result).toHaveProperty('0.length', 1);
        expect(result).toHaveProperty('0.0', 'spam');

        expect(result).toHaveProperty('1.length', 1);
        expect(result).toHaveProperty('1.0', 'spam');
      });
      it('should parse list with a dictionary containing one string field', async () => {
        const data = ascii('ld6:string4:spamee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('length', 1);
        expect(result).toHaveProperty('0.string', 'spam');
      });
    });

    describe('dictionary', () => {
      it('should parse dictionary with one string field', async () => {
        const data = ascii('d6:string4:spame');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('string', 'spam');
      });
      it('should parse dictionary with one integer field', async () => {
        const data = ascii('d7:integeri1ee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('integer', 1);
      });
      it('should parse dictionary with one list field', async () => {
        const data = ascii('d4:listl4:spamee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('list');
        expect(result).toHaveProperty('list.length', 1);
        expect(result).toHaveProperty('list.0', 'spam');
      });
      it('should parse nested dictionary with one field', async () => {
        const data = ascii('d10:dictionaryd6:string4:spamee');
        const result = await parser.parse(data);

        expect(result).toHaveProperty('dictionary');
        expect(result).toHaveProperty('dictionary.string', 'spam');
      });
    });
  });
});
