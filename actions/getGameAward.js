(function () {
  // TO_CHANGE (меняем на свою сумму логику расчета награды за игру)
  const baseSum = 1000;
  const timerMod = 30000 / this.gameTimer;
  const configMod = {}[this.gameConfig] || 1;
  return Math.floor(baseSum * timerMod * configMod);
});
