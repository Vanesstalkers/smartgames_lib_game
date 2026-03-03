({ card, eventGetter } = {}) => {
  const cardMeta = domain.game.configs.cards().find((c) => c.name === card.name);
  const title = cardMeta?.title || card.name;

  let eventDef = null;
  if (!eventGetter) eventGetter = domain.game.events?.card?.[card.code];
  if (eventGetter && typeof eventGetter === 'function') eventDef = eventGetter.call(card);
  if (!eventDef?.text) return null;

  return {
    text: `Карта <a>${title}</a>\n${String(eventDef.text).trim()}`,
    pos: 'bottom-w100',
    buttons: [{ text: 'Спасибо', action: 'exit', exit: true }],
  };
};
