

      let compactMode = false;
      let selectedDate = new Date();
      let currentMonth = selectedDate.getMonth();
      let currentYear = selectedDate.getFullYear();
      let clients = [];
      let events = [];
      let syncQueue = [];
      let tempSchedule = [];
      let paymentClientId = null;
      let editingClientId = null;

      // Select all buttons inside the floating menu
      const buttons = document.querySelectorAll('.menu-btn');

      buttons.forEach(button => {
        button.addEventListener('click', () => {
          // 1. Remove the active class from whichever button currently has it
          document.querySelector('.menu-btn.active')?.classList.remove('active');
          
          // 2. Add the active class to the clicked button
          button.classList.add('active');
        });
      });

      // =============== FUNCTIONS ===================
      function addScheduleItem() {
        const weekday = Number(document.getElementById("scheduleWeekday").value);
        const time = document.getElementById("scheduleTime").value;
        tempSchedule.push({ weekday, time });
        renderScheduleList();
      }
      function amountForEvent(event) {
        const client = clients.find(c => c.id === event.clientId);

        if (event.status === "attended") {
          return client ? client.sessionCost || 0 : 0;
        }

        if (event.status === "noshow") {
          return client ? client.sessionCost || 0 : 0;
        }

        if (event.status === "cancelled") {
          return 0;
        }

        if (event.status === "single") {
          return event.cost || 0;
        }

        return 0;
      }
      function clearAgenda() {
        document.getElementById("agendaPanel").innerHTML = "";
      }
      function clearDatabase() {
        localStorage.clear();

        location.reload();
      }
      function closeClientModal() {
        document.getElementById("clientModal").classList.add("hidden");
      }
      function cycleStatus(clientId, time) {
        const date = isoDate(selectedDate);

        let event = events.find(
          (e) => 
            e.date === date && e.clientId === clientId && e.status !== "single" && (e.time === time || !e.time)
        );

        const current = event ? event.status : "reserved";

        const next =
          STATUS_ORDER[
            (STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length
          ];

        if (next === "reserved") {
          events = events.filter(
            (e) =>
              !(e.date === date && e.clientId === clientId && e.status !== "single" && (e.time === time || !e.time))
          );
        } else {
          if (event) {
            event.status = next;
            event.time = event.time || time;
            event.updatedAt = nowIso();
            queueChange("event:update", event.id);
          } else {
            const newEvent = normalizeEvent({
              id: generateId(),
              trainerId: APP.trainerId,
              date,
              time,
              clientId,
              status: next,
              updatedAt: nowIso(),
            });
            events.push(newEvent);
            queueChange("event:create", newEvent.id);
          }
        }

        refreshAll();
      }
      function deletePurple(id) {
        if (!confirm("Remover aula avulsa?")) {
          return;
        }

        events = events.filter((e) => e.id !== id);
        queueChange("event:delete", id);

        refreshAll();
      }
      function deleteScheduleItem(index) {
        tempSchedule.splice(index, 1);
        renderScheduleList();
      }
      function editClient(id) {
        const client = clients.find((c) => c.id === id);
        if (!client) return;
        editingClientId = id;
        tempSchedule = [...(client.schedule || [])];
        renderScheduleList();
        document.getElementById("clientModalTitle").innerHTML = "Editar Cliente";
        document.getElementById("clientName").value = client.name || "";
        document.getElementById("clientPhone").value = client.phone || "";
        document.getElementById("clientPrice").value = client.sessionCost || 0;
        document.getElementById("scheduleWeekday").value = "1";
        document.getElementById("scheduleTime").value = "07:00";
        document.getElementById("clientModal").classList.remove("hidden");
      }
      function formatAmount(value) {
				return value === 0 ? "0" : `R$ ${value}`;
			}
      function formatDate(dateStr) {
        const d = new Date(dateStr);

        return d.toLocaleDateString("pt-BR");
      }
      function formatShortDate(dateStr) {
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}`;
      }
      function timeToMinutes(time) {
        const [hour, minute] = time.split(":").map(Number);
        return hour * 60 + minute;
      }
      function layoutOverlappingItems(items, durationMinutes) {
        const sorted = items
          .map((item) => ({
            ...item,
            startMin: timeToMinutes(item.time),
            endMin: timeToMinutes(item.time) + durationMinutes,
          }))
          .sort(
            (a, b) =>
              a.startMin - b.startMin || a.name.localeCompare(b.name, "pt-BR"),
          );

        const groups = [];

        sorted.forEach((item) => {
          let group = groups.find((existingGroup) =>
            existingGroup.some(
              (existing) =>
                item.startMin < existing.endMin &&
                item.endMin > existing.startMin,
            ),
          );

          if (!group) {
            group = [];
            groups.push(group);
          }

          group.push(item);
        });

        groups.forEach((group) => {
          const columns = [];

          group.forEach((item) => {
            let columnIndex = columns.findIndex(
              (lastEnd) => item.startMin >= lastEnd,
            );

            if (columnIndex === -1) {
              columnIndex = columns.length;
            }

            columns[columnIndex] = item.endMin;
            item.columnIndex = columnIndex;
          });

          const columnCount =
            Math.max(...group.map((item) => item.columnIndex)) + 1;

          group.forEach((item) => {
            item.columnCount = columnCount;
          });
        });

        return sorted;
      }
      function generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.floor(Math.random() * 1000));
      }
      function getInitialData() {
        return {
          version: DATA_VERSION,
          app: APP,
          clients: [],
          events: [],
          syncQueue: [],
          lastSavedAt: null,
        };
      }
      function nowIso() {
        return new Date().toISOString();
      }
      function normalizeClient(client) {
        return {
          id: client.id || generateId(),
          trainerId: client.trainerId || APP.trainerId,
          name: client.name || "",
          phone: client.phone || "",
          sessionCost: Number(client.sessionCost) || 0,
          color: client.color || "blue",
          avatar: client.avatar || "",
          active: client.active !== false,
          schedule: client.schedule || [],
          paymentHistory: client.paymentHistory || {},
          details: client.details || {},
          updatedAt: client.updatedAt || nowIso(),
          deletedAt: client.deletedAt || null,
        };
      }
      function normalizeEvent(event) {
        return {
          id: event.id || generateId(),
          trainerId: event.trainerId || APP.trainerId,
          date: event.date || "",
          time: event.time || "",
          clientId: event.clientId ?? null,
          name: event.name || null,
          status: event.status || "reserved",
          cost: Number(event.cost) || 0,
          updatedAt: event.updatedAt || nowIso(),
          deletedAt: event.deletedAt || null,
        };
      }
      function queueChange(type, id) {
        syncQueue.push({
          id: generateId(),
          type,
          recordId: id,
          trainerId: APP.trainerId,
          createdAt: nowIso(),
          synced: false,
        });
      }
      function getScheduleFromModal() {
        return [...tempSchedule];
      }
      function getTextWidth(text, font = "16px Helvetica") {
        const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
        const context = canvas.getContext("2d");
        context.font = font;
        return context.measureText(text).width;
      }
      function giraFlecha() {
        const el = document.getElementById('btnToggle');
          el.style.transform = (el.style.transform === 'scaleY(-1)') ? 'scaleY(1)' : 'scaleY(-1)';
      }
      function isoDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      function loadData() {
        try {
          const savedData = localStorage.getItem(APP_STORAGE_KEY);

          if (savedData) {
            const data = JSON.parse(savedData);
            if (data.app && Object.prototype.hasOwnProperty.call(data.app, "trainerId")) {
              APP.trainerId = data.app.trainerId;
            }
            if (
              data.app &&
              Object.prototype.hasOwnProperty.call(data.app, "sessionDuration")
            ) {
              APP.sessionDuration = Number(data.app.sessionDuration) || 60;
            }
            clients = (data.clients || []).map(normalizeClient).filter(c => !c.deletedAt);
            events = (data.events || []).map(normalizeEvent).filter(e => !e.deletedAt);
            syncQueue = data.syncQueue || [];
            return;
          }

          // Backward compatibility with your older localStorage format.
          const savedClients = localStorage.getItem("clients");
          const savedEvents = localStorage.getItem("events");

          if (savedClients) clients = JSON.parse(savedClients).map(normalizeClient).filter(c => !c.deletedAt);
          if (savedEvents) events = JSON.parse(savedEvents).map(normalizeEvent).filter(e => !e.deletedAt);

          if (savedClients || savedEvents) saveData();
        } catch (err) {
          console.error(err);
          //alert("Erro carregando os dados salvos.");
          clients = [];
          events = [];
          syncQueue = [];
        }
      }      
      function openClientModal() {
        editingClientId = null;

        tempSchedule = [];
        renderScheduleList();

        document.getElementById("clientModalTitle").innerHTML = "Adicionar Cliente";
        document.getElementById("clientModal").classList.remove("hidden");

        document.getElementById("clientName").value = "";
        document.getElementById("clientPhone").value = "";
        document.getElementById("clientPrice").value = "";

        document.getElementById("scheduleWeekday").value = "1";
        document.getElementById("scheduleTime").value = "07:00";
      }
      function openPaymentModal(clientId) {
        paymentClientId = clientId;
        const client = clients.find(c => c.id === clientId);

        document.getElementById("paymentClientName").innerHTML = client.name;
        populatePaymentYears();
        renderPaymentMonths();
        document.getElementById("paymentModal").classList.remove("hidden");
      }
      function openSessionModal() {
        if (!selectedDate) {
          alert("Escolha uma data");
          return;
        }

        document.getElementById("sessionModal").classList.remove("hidden");

        document.getElementById("sessionName").value = "";

        document.getElementById("sessionCost").value = 0;
      }
      function paymentBadge(client) {
        const now = new Date();

        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const currentKey =
          `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

        if (client.paymentHistory && client.paymentHistory[currentKey]) {
          return `<span class="payBadge paid">$</span>`;
        }

        let firstMissing = null;

        for (let m = 1; m <= currentMonth; m++) {
          const key =
            `${currentYear}-${String(m).padStart(2, "0")}`;

          if (!client.paymentHistory || !client.paymentHistory[key]) {
            firstMissing = new Date(currentYear, m - 1, 1);
            break;
          }
        }

        const label = firstMissing.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });

        return `
          <span class="payBadge pending">$</span>
          <span>${label}</span>
        `;
      }
      function populateBillingControls() {
        const monthSelect = document.getElementById("billingMonth");
        const yearSelect = document.getElementById("billingYear");

        const now = new Date();

        monthSelect.innerHTML = "";
        yearSelect.innerHTML = "";

        MONTHS.forEach((m, i) => {
          const option = document.createElement("option");
          option.value = String(i + 1).padStart(2, "0");
          option.textContent = m;
          monthSelect.appendChild(option);
        });

        for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
          const option = document.createElement("option");
          option.value = y;
          option.textContent = y;
          yearSelect.appendChild(option);
        }

        monthSelect.value = String(now.getMonth() + 1).padStart(2, "0");
        yearSelect.value = now.getFullYear();
      }
      function populateClientList() {
        const list = document.getElementById("clientList");

        list.innerHTML = "";

        clients.forEach((client) => {
          const option = document.createElement("option");

          option.value = client.name;

          list.appendChild(option);
        });
      }
      function populateTimes() {
        const select = document.getElementById("sessionTime");

        select.innerHTML = "";

        for (let h = 6; h <= 22; h++) {
          const time = String(h).padStart(2, "0") + ":00";

          const option = document.createElement("option");

          option.value = time;
          option.textContent = time;

          select.appendChild(option);
        }
      }
      function populatePaymentYears() {
        const select = document.getElementById("paymentYear");
        const currentYear = new Date().getFullYear();

        select.innerHTML = "";

        for (let y = currentYear - 2; y <= currentYear + 1; y++) {
          const option = document.createElement("option");
          option.value = y;
          option.textContent = y;
          select.appendChild(option);
        }
        select.value = currentYear;
      }
      function printInvoice(clientName) {
        const month = document.getElementById("billingMonth").value;
        const year = document.getElementById("billingYear").value;
        const prefix = `${year}-${month}`;

        const clientEvents = events
          .filter(e => e.date && e.date.startsWith(prefix))
          .filter(e => {
            const client = clients.find(c => c.id === e.clientId);
            const name = client ? client.name : e.name || "Walk-in";
            return name === clientName;
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        const total = clientEvents.reduce((sum, e) => sum + amountForEvent(e), 0);

        const firstDay = `01/${month}/${String(year).slice(2)}`;
        const lastDay = new Date(Number(year), Number(month), 0)
          .toLocaleDateString("pt-BR");

        const rows = clientEvents.map(e => `
          <div class="invoiceRow">
            <span>${STATUS_ICON[e.status] || ""}</span>
            <span>${formatShortDate(e.date)}</span>
            <span>${formatAmount(amountForEvent(e))}</span>
          </div>
        `).join("");

        const html = `
          <html>
            <head>
              <title>Fechamento - ${clientName}</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 0;
                  color: black;
                }

                .invoiceHeader {
                  background: #7b6266;
                  color: white;
                  padding: 30px 20px;
                  text-align: right;
                  border-bottom: 4px solid #f5a0a8;
                }

                .invoiceHeader h1 {
                  font-size: 34px;
                  font-weight: normal;
                  margin: 0;
                }

                .invoiceHeader div {
                  font-size: 16px;
                  margin-top: 8px;
                  letter-spacing: 2px;
                }

                .content {
                  padding: 40px 36px;
                  font-size: 28px;
                }

                .totalBox {
                  background: #7b6266;
                  color: white;
                  display: inline-block;
                  padding: 14px 26px;
                  margin: 30px auto;
                  font-size: 30px;
                  font-weight: bold;
                }

                .center {
                  text-align: center;
                }

                .message {
                  margin: 30px 0;
                  text-align: center;
                  font-size: 30px;
                }

                .invoiceRows {
                  margin-top: 50px;
                }

                .invoiceRow {
                  display: grid;
                  grid-template-columns: 60px 1fr 1fr;
                  gap: 10px;
                  align-items: center;
                  font-size: 30px;
                  margin: 12px 0;
                }

                .invoiceRow span:last-child {
                  text-align: right;
                }
              </style>
            </head>

            <body>
              <div class="invoiceHeader">
                <h1>Bea Meinhardt Cazula</h1>
                <div>FITNESS & PERSONAL TRAINER</div>
              </div>

              <div class="content">
                <p>Olá ${clientName}, segue resumo das aulas entre ${firstDay} e ${lastDay}.</p>

                <div class="center">
                  <div class="totalBox">Valor total: ${formatAmount(total)}</div>
                </div>

                <div class="message">
                  Obrigada! ☺️ 🙏<br>
                  Bora pra mais um mês!!
                </div>

                <div class="invoiceRows">
                  ${rows}
                </div>
              </div>

              <script>
                window.onload = function() {
                  window.print();
                };
              <\/script>
            </body>
          </html>
        `;

        const win = window.open("", "_blank");
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
      function refreshAll() {
        saveData();

        refreshUI();
      }
      function refreshUI() {
        populateClientList();
        renderCalendar();
        renderAgenda();
        resizeAgendaPanel();
        renderClients();
        if (!document.getElementById("billingScreen").classList.contains("hidden")) {
          renderBilling();
        }
      }
			function renderAgenda() {
				if (!selectedDate) {
					clearAgenda();
					return;
				}

				const agenda = document.getElementById("agendaPanel");
				agenda.innerHTML = "";

				const selected = isoDate(selectedDate);
				const weekday = selectedDate.getDay();

				const startHour = 6;
				const endHour = 23;
				const hourHeight = 60;
                const duration = Number(APP.sessionDuration) || 60;
        const appointmentHeight = (duration / 60) * hourHeight;
        const items = [];

        const timeline = document.createElement("div");
        timeline.className = "timeline";
        timeline.style.height = `${(endHour - startHour + 1) * hourHeight}px`;

				for (let h = startHour; h <= endHour; h++) {
					const row = document.createElement("div");
					row.className = "timeRow";
					row.style.top = `${(h - startHour) * hourHeight}px`;

					row.innerHTML = `
						<div class="timeLabel">${String(h).padStart(2, "0")}:00</div>
						<div class="timeLine"></div>
					`;

					timeline.appendChild(row);
				}

				clients.forEach((client) => {
					(client.schedule || [])
						.filter((s) => s.weekday === weekday)
						.forEach((s) => {
							const override = events.find(
								(e) =>
									e.date === selected &&
									e.clientId === client.id &&
									e.time === s.time &&
									e.status !== "single",
							);

							items.push({
								clientId: client.id,
								name: client.name,
								color: client.color,
								time: s.time,
								status: override ? override.status : "reserved",
							});
						});
				});

				events
					.filter((e) => e.date === selected && e.status === "single")
          .forEach((e) => {
            const client = clients.find((c) => c.id === e.clientId);

						items.push({
							purple: true,
							eventId: e.id,
							clientId: e.clientId,
							name: client ? client.name : e.name,
							color: client ? client.color : "purple",
							time: e.time,
							status: "single",
						});
					});

        const laidOutItems = layoutOverlappingItems(items, duration);
        const agendaLeft = 70;
        const agendaRightPadding = 20;
        const gap = 8;
        const availableWidth = Math.max(
          120,
          agenda.clientWidth - agendaLeft - agendaRightPadding,
        );

        laidOutItems.forEach((item) => {
          const [hour, minute] = item.time.split(":").map(Number);
          const top =
            (hour - startHour) * hourHeight + (minute / 60) * hourHeight;
          const columnWidth =
            (availableWidth - gap * (item.columnCount - 1)) / item.columnCount;

          const appt = document.createElement("div");
          appt.className = "timelineAppointment";
          appt.style.top = `${top}px`;
          appt.style.left = `${agendaLeft + item.columnIndex * (columnWidth + gap)}px`;
          appt.style.width = `${columnWidth}px`;
          appt.style.height = `${appointmentHeight}px`;

          const clientExists = clients.some((c) => c.id === item.clientId);

					const pill = document.createElement("div");
					pill.className = `pill ${item.color}`;
					pill.textContent = item.name;

					if (clientExists) {
						pill.addEventListener("click", () => editClient(item.clientId));
					}

					const status = document.createElement("div");
					status.className = "status";
					status.innerHTML = item.purple ? "🟣" : STATUS_ICON[item.status];

					if (item.purple) {
						status.addEventListener("click", () => deletePurple(item.eventId));
					} else {
						status.addEventListener("click", () => cycleStatus(item.clientId, item.time));
					}

					appt.appendChild(pill);
					appt.appendChild(status);
					timeline.appendChild(appt);
				});

				agenda.appendChild(timeline);
				updateHeader();
        resizeAgendaPanel();
			}
      function renderBilling() {
        const list = document.getElementById("billingList");
        const month = document.getElementById("billingMonth").value;
        const year = document.getElementById("billingYear").value;
        const prefix = `${year}-${month}`;

        list.innerHTML = "";

        const grouped = {};

        events
          .filter(e => e.date && e.date.startsWith(prefix))
          .forEach(e => {
            const client =
              clients.find(c => c.id === e.clientId);

            const name =
              client ? client.name : e.name || "Walk-in";

            if (!grouped[name]) {
              grouped[name] = {
                total: 0,
                lines: []
              };
            }

            const amount = amountForEvent(e);

            grouped[name].total += amount;

            grouped[name].lines.push({
              date: e.date,
              status: e.status,
              amount
            });
          });

        Object.keys(grouped)
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .forEach(name => {
            const data = grouped[name];

            const card = document.createElement("div");
            card.className = "billingCard";

            card.innerHTML = `
              <div class="billingHeader">
                <span>${formatAmount(data.total)}</span>
                <span>${name}</span>
                <button class="shareBillingBtn" type="button">📤</button>
              </div>
            `;

            card.querySelector(".shareBillingBtn").addEventListener("click", (event) => {
              event.stopPropagation();
              printInvoice(name);
            });

            data.lines
              .sort((a, b) => a.date.localeCompare(b.date))
              .forEach(line => {
                const div = document.createElement("div");
                div.className = "billingLine";

                div.innerHTML = `
                  <span>${STATUS_ICON[line.status] || ""} ${formatShortDate(line.date)}</span>
                  <span>${formatAmount(line.amount)}</span>
                `;

                card.appendChild(div);
              });

            list.appendChild(card);
          });
      }
      function renderCalendar() {
        const grid = document.getElementById("calendarGrid");

        grid.innerHTML = "";

        const monthLabel = document.getElementById("monthLabel");

        monthLabel.innerHTML = MONTHS[currentMonth] + "/" + currentYear;

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();

        const daysInMonth = new Date(
          currentYear,
          currentMonth + 1,
          0,
        ).getDate();

        for (let i = 0; i < firstDay; i++) {
          const div = document.createElement("div");

          div.className = "day empty";

          grid.appendChild(div);
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const div = document.createElement("div");

          div.className = "day";

          div.innerHTML = day;

          const date = new Date(currentYear, currentMonth, day);

          if (
            selectedDate &&
            date.toDateString() === selectedDate.toDateString()
          ) {
            div.classList.add("selected");
          }

          if (date.toDateString() === new Date().toDateString()) {
            div.classList.add("today");
          }

          div.onclick = () => {
            selectedDate = date;

            renderCalendar();
            renderAgenda();
            updateHeader();
          };

          grid.appendChild(div);
        }
      }
      function renderClients() {
        const list = document.getElementById("clientsList");

        list.innerHTML = "";

        clients.forEach((client) => {
          const card = document.createElement("div");
          card.className = "clientCard";
          card.addEventListener("click", () => editClient(client.id));

          const scheduleText = (client.schedule || [])
            .map(s => weekdayName(s.weekday) + " " + s.time)
            .join("<br>");

          card.innerHTML = `
            <div class="clientColor ${client.color}"></div>
            <div class="clientName">${client.name}</div>
            <div class="clientSchedule">${scheduleText}</div>
            <div class="clientPayment">${paymentBadge(client)}</div>`;

          card.querySelector(".clientPayment").addEventListener("click", (event) => {
            event.stopPropagation();
            openPaymentModal(client.id);
          });

          list.appendChild(card);
        });
      }
      function renderPaymentMonths() {
        const client = clients.find(c => c.id === paymentClientId);
        const year = document.getElementById("paymentYear").value;
        const container = document.getElementById("paymentMonths");

        container.innerHTML = "";
        MONTHS.forEach((month, index) => {
          const key = `${year}-${String(index + 1).padStart(2, "0")}`;
          const div = document.createElement("div");
          div.className = "paymentMonth";

          if (client.paymentHistory && client.paymentHistory[key]) {div.classList.add("selected");}
          div.innerHTML = month;
          div.onclick = () => 
          {
            if (!client.paymentHistory) {client.paymentHistory = {};}
            const clickedMonth = index + 1;

            if (client.paymentHistory[key]) {delete client.paymentHistory[key];} 
            else 
            {
              for (let m = 1; m <= clickedMonth; m++) {
                const monthKey = `${year}-${String(m).padStart(2, "0")}`;
                client.paymentHistory[monthKey] = true;
              }
            }
            client.updatedAt = nowIso();
            queueChange("client:update", client.id);
            saveData();
            renderPaymentMonths();
          };          
          container.appendChild(div);
        });
      }
      function renderScheduleList() {
        const list = document.getElementById("scheduleList");
        list.innerHTML = "";

        tempSchedule.forEach((s, index) => {
          const row = document.createElement("div");
          row.className = "scheduleItem";
          row.innerHTML = `
            <span>${weekdayName(s.weekday)} - ${s.time}</span>
            <button type="button">🗑</button>`;

          row.querySelector("button").addEventListener("click", () => {
            deleteScheduleItem(index);
          });

          list.appendChild(row);
        });
      }
      function saveClient() {
        const name = document.getElementById("clientName").value.trim();

        if (!name) {alert("Preciso de um Nome 😰"); return;}

        const phone = document.getElementById("clientPhone").value.trim();
        const price = Number(document.getElementById("clientPrice").value) || 0;
        const schedule = getScheduleFromModal();

        if (editingClientId) 
        {
          const client = clients.find((c) => c.id === editingClientId);
          client.trainerId = client.trainerId || APP.trainerId;
          client.name = name;
          client.phone = phone;
          client.sessionCost = price;
          client.schedule = schedule;
          client.updatedAt = nowIso();
          queueChange("client:update", client.id);
        } 
        else 
        {
          const client = normalizeClient({
            id: generateId(),
            trainerId: APP.trainerId,
            name,
            phone,
            sessionCost: price,
            color: "blue",
            avatar: "",
            active: true,
            schedule,
            paymentHistory: {},
            details: {},
            updatedAt: nowIso()
          });
          clients.push(client);
          queueChange("client:create", client.id);
        }
        editingClientId = null;
        closeClientModal();
        refreshAll();
      }
      function saveData() {
        try {
          const data = {
            version: DATA_VERSION,
            app: APP,
            clients,
            events,
            syncQueue,
            lastSavedAt: nowIso()
          };

          localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));

          // Temporary compatibility while you are testing older versions.
          localStorage.setItem("clients", JSON.stringify(clients));
          localStorage.setItem("events", JSON.stringify(events));
        } catch (err) {
          alert("Não consegui salvar os dados neste aparelho.");
          console.error(err);
        }
      }
      function resizeAgendaPanel() {
        const agenda = document.getElementById("agendaPanel");
        const agendaScreen = document.getElementById("agendaScreen");

        if (!agenda || !agendaScreen || agendaScreen.classList.contains("hidden")) {
          return;
        }

        requestAnimationFrame(() => {
          const menu = document.getElementById("menuBottom");
          const agendaTop = agenda.getBoundingClientRect().top;
          const menuTop = menu ? menu.getBoundingClientRect().top : window.innerHeight;
          const bottomGap = 10;
          const availableHeight = menuTop - agendaTop - bottomGap;

          agenda.style.height = `${Math.max(180, availableHeight)}px`;
        });
      }
      function selectTodayIfCurrentMonth() {
        const today = new Date();
        if (currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
          selectedDate = today;
        }
      }
      function toggleCalendar() {
        compactMode = !compactMode;
        document.getElementById("calendarPanel").classList.toggle("hidden");
        giraFlecha();
        updateHeader();
        resizeAgendaPanel();
      }
      function updateHeader() {
        const title = document.getElementById("title");

        if (compactMode && selectedDate) {
          title.innerHTML = formatDate(selectedDate);
          title.style.height = "30px";
          title.style.paddingTop = "16px";
        } else {
          title.innerHTML = "";
          title.style.height = "1px";
          title.style.paddingTop = "1px";
        }
      }
      function weekdayName(day) {
        return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][day];
      }

      // =============== EVENTOS ==============================

      document.getElementById("btnCancelSession").onclick = () => {
        document.getElementById("sessionModal").classList.add("hidden");
      };
      document.getElementById("btnSaveSession").onclick = () => {
        const name = document.getElementById("sessionName").value.trim();

        if (!name) {alert("Preciso de um Nome 😰"); return;}

        const time = document.getElementById("sessionTime").value;
        const cost = Number(document.getElementById("sessionCost").value);
        const client = clients.find((c) => c.name.toLowerCase() === name.toLowerCase(),);

        const newEvent = normalizeEvent({
          id: generateId(),
          trainerId: APP.trainerId,
          date: isoDate(selectedDate),
          time,
          clientId: client ? client.id : -10,
          name: client ? null : name,
          status: "single",
          cost,
          updatedAt: nowIso()
        });
        events.push(newEvent);
        queueChange("event:create", newEvent.id);

        document.getElementById("sessionModal").classList.add("hidden");
        refreshAll();
      };
      document.getElementById("prevMonth").onclick = () => {
        currentMonth--;

        if (currentMonth < 0) {
          currentMonth = 11;
          currentYear--;
        }

        selectedDate = null;

        selectTodayIfCurrentMonth();

        renderCalendar();

        if (selectedDate) {
          renderAgenda();
        } else {
          clearAgenda();
        }

        updateHeader();
      };
      document.getElementById("nextMonth").onclick = () => {
        currentMonth++;

        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }

        selectedDate = null;

        selectTodayIfCurrentMonth();

        renderCalendar();

        if (selectedDate) {
          renderAgenda();
        } else {
          clearAgenda();
        }

        updateHeader();
      };
      document.getElementById("btnToggle").addEventListener("click", toggleCalendar);
      document.getElementById("btnWalkIn").addEventListener("click", () => {
        openSessionModal();
      });
      document.getElementById("btnAgendaTab").onclick = () => {
        document.getElementById("btnWalkIn").style.visibility = "visible";
        document.getElementById("btnToggle").style.visibility = "visible";
        document.getElementById("agendaScreen").classList.remove("hidden");
        document.getElementById("clientsScreen").classList.add("hidden");
        document.getElementById("billingScreen").classList.add("hidden");
        resizeAgendaPanel();
      };  
      document.getElementById("btnClientsTab").onclick = () => {
        document.getElementById("btnWalkIn").style.visibility = "hidden";
        document.getElementById("btnToggle").style.visibility = "hidden";
        document.getElementById("agendaScreen").classList.add("hidden");
        document.getElementById("clientsScreen").classList.remove("hidden");
        document.getElementById("billingScreen").classList.add("hidden");
        renderClients();
      };
      document.getElementById("btnBillingTab").onclick = () => {
        document.getElementById("btnWalkIn").style.visibility = "hidden";
        document.getElementById("btnToggle").style.visibility = "hidden";
        document.getElementById("agendaScreen").classList.add("hidden");
        document.getElementById("clientsScreen").classList.add("hidden");
        document.getElementById("billingScreen").classList.remove("hidden");
        renderBilling();
      };
      document.getElementById("btnAddClient").onclick = openClientModal;
      document.getElementById("btnCancelClient").onclick = closeClientModal;
      document.getElementById("btnSaveClient").onclick = saveClient;
      document.getElementById("btnAddSchedule").onclick = addScheduleItem;
      document.getElementById("paymentYear").addEventListener("change", renderPaymentMonths);
      document.getElementById("btnCancelPayment").onclick = () => {document.getElementById("paymentModal").classList.add("hidden");};
      document.getElementById("btnSavePayment").onclick = () => {document.getElementById("paymentModal").classList.add("hidden"); refreshAll();};
      document.getElementById("billingMonth").onchange = renderBilling;
      document.getElementById("billingYear").onchange = renderBilling;


      window.addEventListener("resize", resizeAgendaPanel);
      window.addEventListener("orientationchange", resizeAgendaPanel);

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", resizeAgendaPanel);
      }

      loadData();
      populateBillingControls();
      populateClientList();
      populateTimes();
      refreshUI();








