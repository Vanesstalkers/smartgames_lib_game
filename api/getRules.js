({
  access: 'public',
  method: async (context) => {
    return {
      status: 'ok',
      rules: domain.game.configs.rules(),
    };
  },
});

