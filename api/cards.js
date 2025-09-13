({
  access: 'public',
  method: async (context, { selectGroup, template } = {}) => {
    if (!template) template = domain.game.configs.cardTemplates.random();
    const { path, list, filter = () => true } = domain.game.configs.cards();

    const cards = list
      .filter((card) => !selectGroup || card.group === selectGroup)
      .filter(filter)
      .map(path)
      .map((path) => `${template}/${path}`);

    return { status: 'ok', cards };
  },
});
