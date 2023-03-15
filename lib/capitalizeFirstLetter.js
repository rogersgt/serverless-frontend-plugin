function capitalizeFirstLetter(string) {
  if (typeof string !== 'string') return string;
  if (string.length < 1) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}


module.exports = {
  capitalizeFirstLetter,
}
