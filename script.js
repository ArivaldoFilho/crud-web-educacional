// ===== Util =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const formatDate = (iso) => new Date(iso).toLocaleDateString("pt-BR");
const uid = () => crypto.randomUUID();

// ===== Storage =====
const DB = {
  usersKey: "matriculas_users",
  sessionKey: "matriculas_session",
  dataKey: "matriculas_registros",
  get users() {
    return JSON.parse(localStorage.getItem(this.usersKey) || "[]");
  },
  set users(v) {
    localStorage.setItem(this.usersKey, JSON.stringify(v));
  },
  get session() {
    return JSON.parse(localStorage.getItem(this.sessionKey) || "null");
  },
  set session(v) {
    localStorage.setItem(this.sessionKey, JSON.stringify(v));
  },
  get regs() {
    return JSON.parse(localStorage.getItem(this.dataKey) || "[]");
  },
  set regs(v) {
    localStorage.setItem(this.dataKey, JSON.stringify(v));
  },
};

// ===== UI =====
function updateStats() {
  const regs = DB.regs;
  $("#stats") && ($("#stats").textContent = `${regs.length} matrículas`);
}

function setAuthUI(logged) {
  $("#authCard").hidden = logged;
  $("#appCard").hidden = !logged;

  if (logged) {
    const role = DB.session.role;

    // Controle de abas
    document.querySelector('[data-tab="cadastro"]').style.display =
      role === "admin" || role === "funcionario" ? "block" : "none";

    document.querySelector('[data-tab="lista"]').style.display = "block";
    document.querySelector('[data-tab="historico"]').style.display = "block";

    document.querySelector('[data-tab="admin"]').style.display =
      role === "admin" ? "block" : "none";

    // Botão exportar CSV
    $("#btnExport").style.display =
      role === "admin" || role === "funcionario" ? "inline-block" : "none";

    renderTable();
  }
}

function setActiveTab(tab) {
  $$("#appCard .tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  $$("#appCard .tabpanel").forEach((p) => (p.hidden = p.id !== tab));

  if (tab === "historico") renderHistorico();
  if (tab === "admin" && DB.session.role === "admin") renderUsers();
}

// ===== App Tabs =====
document.querySelectorAll("#appCard .tab").forEach((btn) =>
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab))
);

// ===== Auth =====
$("#demoUser").onclick = () => {
  DB.users = [
    {
      id: uid(),
      name: "Admin Demo",
      email: "admin@demo.com",
      passHash: "123",
      role: "admin",
    },
  ];
  $("#loginEmail").value = "admin@demo.com";
  $("#loginPassword").value = "123";
};

$("#loginForm").onsubmit = (e) => {
  e.preventDefault();
  const email = $("#loginEmail").value.toLowerCase(),
    p = $("#loginPassword").value;
  const u = DB.users.find((x) => x.email === email && x.passHash === p);
  if (!u) {
    $("#loginMsg").textContent = "Login inválido";
    return;
  }
  DB.session = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  };
  $("#helloUser").textContent = `Olá, ${u.name} (${u.role})`;
  setAuthUI(true);
  renderTable();
  updateStats();
};

$("#logout").onclick = () => {
  DB.session = null;
  setAuthUI(false);
};

// ===== Form Matrícula =====
function getFormData() {
  const f = $("#documento");
  return {
    id: $("#formMat").dataset.editing || uid(),
    aluno: $("#aluno").value,
    nascimento: $("#nascimento").value,
    sexo: $("#sexo").value,
    numero: $("#numero").value,
    data: $("#data").value || new Date().toISOString().slice(0, 10),
    turma: $("#turma").value,
    escolaAnterior: $("#escolaAnterior").value,
    responsavel: $("#responsavel").value,
    parentesco: $("#parentesco").value,
    telResponsavel: $("#telResponsavel").value,
    emailResponsavel: $("#emailResponsavel").value,
    enderecoResponsavel: $("#enderecoResponsavel").value,
    telAdicional: $("#telAdicional").value,
    alergia: $("#alergia").value,
    descAlergia: $("#descAlergia").value,
    medicamento: $("#medicamento").value,
    descMedicamento: $("#descMedicamento").value,
    necessidadeEspecial: $("#necessidadeEspecial").value,
    descNecessidade: $("#descNecessidade").value,
    status: $("#status").value,
    documento: f.files[0]
      ? {
          name: f.files[0].name,
          type: f.files[0].type,
          size: f.files[0].size,
          content: null,
        }
      : null,
  };
}
function setFormData(r) {
  $("#formMat").dataset.editing = r?.id || "";
  $("#aluno").value = r?.aluno || "";
  $("#nascimento").value = r?.nascimento || "";
  $("#sexo").value = r?.sexo || "";
  $("#numero").value = r?.numero || "";
  $("#data").value = r?.data || "";
  $("#turma").value = r?.turma || "";
  $("#escolaAnterior").value = r?.escolaAnterior || "";
  $("#responsavel").value = r?.responsavel || "";
  $("#parentesco").value = r?.parentesco || "";
  $("#telResponsavel").value = r?.telResponsavel || "";
  $("#emailResponsavel").value = r?.emailResponsavel || "";
  $("#enderecoResponsavel").value = r?.enderecoResponsavel || "";
  $("#telAdicional").value = r?.telAdicional || "";
  $("#alergia").value = r?.alergia || "nao";
  $("#descAlergia").value = r?.descAlergia || "";
  $("#medicamento").value = r?.medicamento || "nao";
  $("#descMedicamento").value = r?.descMedicamento || "";
  $("#necessidadeEspecial").value = r?.necessidadeEspecial || "nao";
  $("#descNecessidade").value = r?.descNecessidade || "";
  $("#status").value = r?.status || "Ativa";
}

function salvarRegistro(reg, regs) {
  const ix = regs.findIndex((r) => r.id === reg.id);
  if (ix >= 0) {
    const hist = JSON.parse(
      localStorage.getItem("matriculas_historico") || "[]"
    );
    hist.push({ ...regs[ix], alteradoEm: new Date().toISOString() });
    localStorage.setItem("matriculas_historico", JSON.stringify(hist));
    regs[ix] = reg;
  } else regs.push(reg);
  DB.regs = regs;
  setFormData(null);
  renderTable();
  updateStats();
}

$("#formMat").onsubmit = (e) => {
  e.preventDefault();
  const role = DB.session.role;
  if (role === "direcao") {
    alert("Acesso negado: Direção não pode cadastrar.");
    return;
  }
  const reg = getFormData(),
    regs = DB.regs;
  if (reg.documento && $("#documento").files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      reg.documento.content = reader.result;
      salvarRegistro(reg, regs);
    };
    reader.readAsDataURL($("#documento").files[0]);
  } else {
    salvarRegistro(reg, regs);
  }
};

// ===== Tabela Matrículas =====
function applyFilters(list) {
  const q = $("#q").value.toLowerCase(),
    di = $("#dInicio").value ? new Date($("#dInicio").value) : null,
    df = $("#dFim").value ? new Date($("#dFim").value) : null,
    t = $("#fTurma").value.toLowerCase(),
    s = $("#fStatus").value;
  return list.filter(
    (r) =>
      (!q ||
        r.aluno.toLowerCase().includes(q) ||
        r.numero.toLowerCase().includes(q)) &&
      (!t || r.turma.toLowerCase().includes(t)) &&
      (!s || r.status === s) &&
      (!di || new Date(r.data) >= di) &&
      (!df || new Date(r.data) <= df)
  );
}
function renderTable() {
  const tbody = $("#tbl tbody");
  tbody.innerHTML = "";
  let rows = applyFilters(DB.regs);
  $("#count").textContent = `${rows.length} registros`;
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const role = DB.session?.role || "direcao";
    tr.innerHTML = `<td>${r.aluno}</td>
      <td>${r.numero}</td>
      <td>${formatDate(r.data)}</td>
      <td>${r.turma || "-"}</td>
      <td><span class="status ${r.status}">${r.status}</span></td>
      <td>${r.responsavel || "-"}</td>
      <td>${
        r.documento
          ? `<a href="${r.documento.content}" download="${r.documento.name}" target="_blank">📎 ${r.documento.name}</a>`
          : "-"
      }</td>
      <td>${
        role === "admin" || role === "funcionario"
          ? `<button data-edit="${r.id}">Editar</button><button data-del="${r.id}">Excluir</button>`
          : "-"
      }</td>`;
    tbody.appendChild(tr);
  });

  if (DB.session.role === "admin" || DB.session.role === "funcionario") {
    $$("[data-edit]").forEach((b) => {
      b.onclick = () => {
        setFormData(DB.regs.find((x) => x.id === b.dataset.edit));
        setActiveTab("cadastro");
      };
    });
    $$("[data-del]").forEach((b) => {
      b.onclick = () => {
        if (confirm("Excluir?")) {
          DB.regs = DB.regs.filter((x) => x.id !== b.dataset.del);
          renderTable();
          updateStats();
        }
      };
    });
  }
}
["q", "dInicio", "dFim", "fTurma", "fStatus"].forEach(
  (id) => ($("#" + id).oninput = () => renderTable())
);

// ===== CSV Export =====
$("#btnExport").onclick = () => {
  if (DB.session.role === "direcao") {
    alert("Acesso negado: Direção não pode exportar CSV.");
    return;
  }
  const rows = applyFilters(DB.regs),
    csv = [
      ["Aluno", "Matrícula", "Data", "Turma", "Status", "Responsável"],
      ...rows.map((r) => [
        r.aluno,
        r.numero,
        r.data,
        r.turma,
        r.status,
        r.responsavel,
      ]),
    ]
      .map((l) => l.join(","))
      .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "matriculas.csv";
  a.click();
};

// ===== Histórico =====
function renderHistorico() {
  const tb = $("#tblHistorico");
  tb.innerHTML = "";
  JSON.parse(localStorage.getItem("matriculas_historico") || "[]").forEach(
    (h) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${h.aluno}</td>
        <td>${h.numero}</td>
        <td>${h.turma}</td>
        <td>${h.status}</td>
        <td>${formatDate(h.alteradoEm)}</td>`;
      tb.appendChild(tr);
    }
  );
}

// ===== Administração (Usuários) =====
function renderUsers() {
  const tb = $("#tblUsers tbody");
  tb.innerHTML = "";
  DB.users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.role}</td>
      <td>${
        u.email !== DB.session.email
          ? `<button data-deluser="${u.id}">Excluir</button>`
          : "(você)"
      }</td>`;
    tb.appendChild(tr);
  });

  $$("[data-deluser]").forEach((b) => {
    b.onclick = () => {
      if (confirm("Excluir este usuário?")) {
        DB.users = DB.users.filter((x) => x.id !== b.dataset.deluser);
        renderUsers();
      }
    };
  });
}

$("#userForm").onsubmit = (e) => {
  e.preventDefault();
  const name = $("#uName").value,
    email = $("#uEmail").value.toLowerCase(),
    pass = $("#uPass").value,
    role = $("#uRole").value;
  if (DB.users.some((x) => x.email === email)) {
    alert("Email já existe!");
    return;
  }
  DB.users = [...DB.users, { id: uid(), name, email, passHash: pass, role }];
  $("#userForm").reset();
  renderUsers();
};

// ===== Boot =====
(function () {
  if (DB.session) {
    $("#helloUser").textContent = `Olá, ${DB.session.name} (${DB.session.role})`;
    setAuthUI(true);
    renderTable();
    updateStats();
  }
  $("#data").value = new Date().toISOString().slice(0, 10);
})();
