({
  steps: {
    planeControlsMouseLeft: {
      initialStep: true,
      text: `
        При зажатой левой кнопке мыши можно перемещать игровое поле.
      `,
      img: '/img/tutorial/mouse-left.png',
      actions: {
        before: ({ state: { isMobile } }) => {
          const skipStep = isMobile ? { goto: { step: 'center' } } : false;
          return { skipStep };
        },
      },
      buttons: [
        { text: 'Продолжай', step: 'planeControlsMouseMiddle' },
      ],
    },
    planeControlsMouseMiddle: {
      text: `
        Колесиком мыши можно приближать и удалять игровое поле.
      `,
      img: '/img/tutorial/mouse-middle.png',
      actions: {
        before: ({ state: { isMobile } }) => {
          const skipStep = isMobile ? { goto: { step: 'planeControlsTouchMove' } } : false;
          return { skipStep };
        },
      },
      buttons: [
        { text: 'Продолжай', step: 'center' },
      ],
    },
    planeControlsTouchMove: {
      text: `
        Игровое поле можно перемещать.
      `,
      img: '/img/tutorial/touch-move.png',
      actions: {
        before: ({ state: { isMobile } }) => {
          const skipStep = isMobile ? { goto: { step: 'planeControlsTouchScroll' } } : false;
          return { skipStep };
        },
      },
      buttons: [
        { text: 'Продолжай', step: 'planeControlsTouchScroll' },
      ],
    },
    planeControlsTouchScroll: {
      text: `
        Также можно менять его масштаб.
      `,
      img: '/img/tutorial/touch-scroll.png',
      actions: {
        before: ({ state: { isMobile } }) => {
          const skipStep = isMobile ? { goto: { step: 'center' } } : false;
          return { skipStep };
        },
      },
      buttons: [
        { text: 'Продолжай', step: 'center' },
      ],
    },
    center: {
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
