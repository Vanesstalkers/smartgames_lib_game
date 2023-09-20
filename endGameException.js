(class EndGameException {
  constructor(message) {
    this.message = message || 'Game finished';
    this.name = 'EndGameException';
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    else this.stack = new Error().stack;
  }
});
