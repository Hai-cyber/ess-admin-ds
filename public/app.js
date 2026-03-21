async function checkHealth() {
  const el = document.getElementById("status");

  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    el.textContent = `API OK: ${data.service} @ ${data.time}`;
  } catch (err) {
    el.textContent = `API lỗi: ${err.message}`;
  }
}

async function loadBookings() {
  const list = document.getElementById("list");
  list.innerHTML = "Đang tải bookings...";

  try {
    const res = await fetch("/api/admin/list");
    const data = await res.json();

    if (!data.items || !data.items.length) {
      list.innerHTML = "<p>Không có dữ liệu</p>";
      return;
    }

    list.innerHTML = data.items.map(item => `
      <div class="card">
        <div><strong>${item.booking_id}</strong> - ${item.guest_name}</div>
        <div>${item.date} ${item.time}</div>
        <div>Stage: ${item.stage}</div>
        <div>Guests: ${item.guests}</div>
      </div>
    `).join("");
  } catch (err) {
    list.innerHTML = `<p>Lỗi: ${err.message}</p>`;
  }
}

document.getElementById("btnLoad").addEventListener("click", loadBookings);

checkHealth();
