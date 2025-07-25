({
  steps: {
    win: {
      text: 'Поздравляю, ты победил в последней игре. Твой заработок составил [[win-money]].',
      buttons: [{ text: 'Круто!', action: 'exit' }],
      img: './img/tutorial/win.png',
      superPos: true,
    },
    lose: {
      text: 'К сожалению ты проиграл последнюю игру, но это не страшно - в следующий раз точно будет победа!',
      buttons: [{ text: 'Обязательно будет!', action: 'exit' }],
      img: './img/tutorial/lose.png',
      superPos: true,
    },
    cancel: {
      text: 'Последняя игра была отменена по причине выхода одного из игроков.',
      buttons: [{ text: 'Понятно, спасибо.', action: 'exit' }],
      superPos: true,
    },
  },
});
