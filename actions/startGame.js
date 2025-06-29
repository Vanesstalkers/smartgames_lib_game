(function () {
  this.set({ status: 'IN_PROCESS' });
  this.run('initGameProcessEvents');
  this.run('roundStart');
});
