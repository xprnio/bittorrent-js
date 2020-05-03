export type BepList = Array<any>;
export type BepDictionary = { [key: string]: string | number | BepList | BepDictionary };
export type ParserValue = null | string | number | BepList | KeyValuePair;
export type ParserCallback = (err?: Error, result?: ParserValue) => void;

export interface ParserQueueItem {
  type: null | 'string' | 'integer' | 'list' | 'dictionary';
  value: ParserValue;
  length: number | null;
  parent?: ParserListItem | ParserDictionaryItem;
}

export interface ParserStringItem {
  type: 'string';
  value: null | string;
  length: number | null;
  parent?: ParserListItem | ParserDictionaryItem;
}

export interface ParserIntegerItem {
  type: 'integer';
  stringValue: null | string;
  value: null | number;
  length: null;
  parent?: ParserListItem | ParserDictionaryItem;
}

export interface ParserListItem {
  type: 'list';
  value: null | BepList;
  length: null | number;
  parent?: ParserListItem | ParserDictionaryItem;
}

export interface ParserDictionaryItem {
  type: 'dictionary';
  keyValuePairs: Array<KeyValuePair>;
  value: null | BepDictionary;
  length: number | null;
  parent?: ParserListItem | ParserDictionaryItem;
}

export interface KeyValuePair {
  key?: null | string;
  value?: null | string | number | BepList | KeyValuePair;
}

export interface ParserState {
  queue: Array<ParserQueueItem>;
  value: null | ParserValue;
}
