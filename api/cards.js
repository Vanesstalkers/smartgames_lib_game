({
  access: 'public',
  method: async (context, { template } = {}) => {
    if (!template) template = domain.game.configs.cardTemplates.random();
    const { path, list } = domain.game.configs.cards();

    const cards = list.map(path)
      .filter((value, index, array) => array.indexOf(value) === index);

    return { status: 'ok', cards };
  },
});
