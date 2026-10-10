function updateClock() {
  const clock = document.getElementById('desktop-clock');
  if (!clock) return;
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  clock.textContent = time;
}

updateClock();
setInterval(updateClock, 60000);
