({
  steps: {
    restore: {
      initialStep: true,
      pos: 'bottom-left',
      text: 'Какой раунд игры восстановить?',
      input: (game) => {
        return [
          { value: game.round, name: 'restoreForcedInputRound' },
          {
            type: 'select',
            name: 'restoreForcedInputRoundStep',
            value: game.roundStep,
            options: Object.keys(game.roundStepsMap).map((step) => ({ value: step })),
          },
        ];
      },
      actions: {
        submit: async ({ inputData }) => {
          const { restoreForcedInputRound: round, restoreForcedInputRoundStep: roundStep } = inputData;
          await api.action.call({ path: 'game.api.restoreForced', args: [{ round, roundStep }] }).catch(prettyAlert);

          return { exit: true };
        },
      },
      buttons: [
        { text: 'Выполнить', action: 'submit' },
        { text: 'Отмена', action: 'exit' },
      ],
    },
  },
});
