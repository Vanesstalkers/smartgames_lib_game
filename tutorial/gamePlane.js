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
          const skipStep = isMobile ? true : false;
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
          const skipStep = isMobile ? false : true;
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
          const skipStep = isMobile ? false : true;
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
        { text: 'Спасибо', action: 'exit' }
      ],
    },
  },
});
