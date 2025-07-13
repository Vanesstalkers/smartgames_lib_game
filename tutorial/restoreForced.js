({
  steps: {
    restore: {
      initialStep: true,
      pos: 'bottom-left',
      text: 'Какой раунд игры восстановить?',
      html: (game) => `
        <div v-if="menu.input" class="input">
          <input value="${game.round}" placeholder="${game.round}" name="restoreForcedInput" type="number" min="1" max="${game.round}" />
        </div>
      `,
      actions: {
        submit: async ({ inputData: { restoreForcedInput: round } }) => {
          await api.action
            .call({ path: 'game.api.restoreForced', args: [{ round }] })
            .catch(prettyAlert);
          return { exit: true };
        }
      },
      buttons: [
        { text: 'Выполнить', action: 'submit' },
        { text: 'Отмена', action: 'exit' },
      ],
    },
  },
});
