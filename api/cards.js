({
  access: 'public',
  method: async (context, { selectGroup, template } = {}) => {
    if (!template) template = domain.game.configs.cardTemplates.random();
    const cards = domain.game.configs.cards({ apiRequest: true, selectGroup, template });
    return { status: 'ok', cards };
  },
});
