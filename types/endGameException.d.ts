declare class EndGameException extends Error {
  name: 'EndGameException';
  constructor(message?: string);
}

export = EndGameException;
