const STATUS_LABELS = {
  'NS': 'Scheduled',
  'TBD': 'Time TBD',
  '1H': '1st Half',
  'HT': 'Half-Time',
  '2H': '2nd Half',
  'ET': 'Extra Time',
  'BT': 'Break Time',
  'P': 'Penalties',
  'AET': 'After Extra Time',
  'FT': 'Full-Time',
  'PEN': 'Penalties',
  'PST': 'Postponed',
  'CANC': 'Cancelled',
  'ABD': 'Abandoned',
  'SUSP': 'Suspended',
  'INT': 'Interrupted',
  'Q1': '1st Qtr',
  'Q2': '2nd Qtr',
  'Q3': '3rd Qtr',
  'Q4': '4th Qtr',
  'OT': 'Overtime',
  'S1': 'Set 1',
  'S2': 'Set 2',
  'S3': 'Set 3',
  'S4': 'Set 4',
  'S5': 'Set 5',
  'P1': '1st Period',
  'P2': '2nd Period',
  'P3': '3rd Period',
  'AW': 'Awarded',
  'WO': 'Walkover',
  'POST': 'Postponed'
};

export const formatStatus = (code, fallback = 'Scheduled') => {
  if (!code) return fallback;
  const upper = code.toString().trim().toUpperCase();
  return STATUS_LABELS[upper] || upper;
};

export const formatMatchKickoff = (dateString, timeZone = 'Asia/Kolkata') => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  try {
    const timeFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const dateFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      month: 'short',
      day: 'numeric'
    });

    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();

    const formattedTime = timeFormatter.format(date);
    return isToday ? `${formattedTime} IST` : `${dateFormatter.format(date)}, ${formattedTime} IST`;
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};
