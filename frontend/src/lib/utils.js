export const generateMemberId = (areaCode) => {
  let sequence = localStorage.getItem(areaCode) || 0;
  sequence = parseInt(sequence) + 1;
  localStorage.setItem(areaCode, sequence);
  return `${areaCode}${String(sequence).padStart(6, '0')}`;
};