({
  access: 'public',
  method: async (context, { selectGroup, template, unique } = {}) => {
    if (!template) template = domain.game.configs.cardTemplates.random();
    const cards = domain.game.configs.cards({ apiRequest: true, selectGroup, template, unique });
    return { status: 'ok', cards };
  },
});
