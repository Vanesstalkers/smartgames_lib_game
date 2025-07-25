({
  steps: {
    planeControls: {
      initialStep: true,
      text: `
        Кнопка центровки может быть полезна, если игровое поле переместилось за пределы экрана.
      `,
      active: '.gui-btn.move',
      buttons: [
        { text: 'Продолжай', step: 'logs' }
      ],
    },
    logs: {
      text: `
        Это кнопка доступа к логам текущей игры.
      `,
      active: '.gui-btn.log',
      actions: {
        before: ({ $root }) => {
          const $log = $root.querySelector('.gui-btn.log');
          if (!$log.classList.contains('active')) $log.click();
        },
      },
      buttons: [
        { text: 'Продолжай', step: 'chat' },
      ],
    },
    chat: {
      text: `
        Это кнопка доступа к чату игроков. В списке доступных каналов, помимо личных и общего чата, присутствует чат текущей игры.
      `,
      active: '.gui-btn.chat',
      actions: {
        before: ({ $root }) => {
          const $chat = $root.querySelector('.gui-btn.chat');
          if (!$chat.classList.contains('active')) $chat.click();
        },
        customExit: async ({ $root }) => {
          const $chat = $root.querySelector('.gui-btn.chat');
          if ($chat.classList.contains('active')) $chat.click();
          return { exit: true };
        },
      },
      buttons: [
        { text: 'Понятно, спасибо', action: 'customExit' },
      ],
    },
  },
});
