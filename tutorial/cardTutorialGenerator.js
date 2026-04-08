({ card, eventGetter } = {}) => {
  let eventDef = null;
  if (!eventGetter) eventGetter = domain.game.events?.card?.[card.name];
  if (eventGetter && typeof eventGetter === 'function') eventDef = eventGetter.call(card);

  const tutorial = eventDef?.tutorial;
  if (!tutorial) return null;

  let { text, showTitle, pos = 'bottom-w100', superPos = false } = tutorial;
  if (!text) return null;

  if (typeof text === 'function') text = text(card);
  if (showTitle) text = `<b>${card.title}</b>\n${text}`;

  return {
    ...{ text: String(text).trim(), pos, superPos },
    buttons: [{ text: 'Спасибо', action: 'exit', exit: true }],
  };
};
