interface OxfordLexicalCategory {
    id: string;
    text: string;
  }
  
  export interface OxfordSenses {
    definitions?: string[];
    id?: string;
    subsenses?: OxfordSenses[];
  }
  
  interface OxfordLexicalSubEntry {
    senses: OxfordSenses[];
  }
  
  interface OxfordLexicalInflection {
    id: string;
    text: string;
  }
  
  interface OxfordLexicalEntry {
    entries: OxfordLexicalSubEntry[];
    language: string;
    text: string;
    lexicalCategory: OxfordLexicalCategory;
    inflectionOf?: OxfordLexicalInflection[]; 
  }
  
  interface OxfordResult {
    id: string;
    language: string;
    lexicalEntries: OxfordLexicalEntry[];
    type: string;
    word: string;
  }
  
  interface OxfordMetaData {
    operation: string;
    provder: string;
    schema: string;
  }
  
  export interface OxfordData {
    id: string;
    metadata: OxfordMetaData;
    results: OxfordResult[];
    word: string;
  }
  