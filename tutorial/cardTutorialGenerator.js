({ card, eventGetter } = {}) => {
  let eventDef = null;
  if (!eventGetter) eventGetter = domain.game.events?.card?.[card.name];
  if (eventGetter && typeof eventGetter === 'function') eventDef = eventGetter.call(card);

  const tutorialText = eventDef?.tutorial?.text;
  if (!tutorialText) return null;

  const text = typeof tutorialText === 'function' ? tutorialText(card) : tutorialText;
  return {
    text: String(text).trim(),
    pos: 'bottom-w100',
    buttons: [{ text: 'Спасибо', action: 'exit', exit: true }],
  };
};
