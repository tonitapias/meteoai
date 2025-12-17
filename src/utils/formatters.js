export const formatTemp = (tempC, unit) => {
  if (unit === 'F') return Math.round((tempC * 9/5) + 32);
  return Math.round(tempC);
};

export const getUnitLabel = (unit) => unit === 'F' ? '°F' : '°C';

export const formatDate = (dateString, lang, options) => {
  const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
  const date = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat(locales[lang], options).format(date);
};

export const formatTime = (dateString, lang) => {
  const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
  return new Date(dateString).toLocaleTimeString(locales[lang], {hour:'2-digit', minute:'2-digit'});
};