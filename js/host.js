const ws = new WebSocket(`wss://${location.host}`);

const canalJoc = {
  postMessage: (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      ws.addEventListener("open", () => ws.send(JSON.stringify(data)), { once: true });
    }
  },
  onmessage: null,
};

ws.addEventListener("message", (event) => {
  if (canalJoc.onmessage) {
    canalJoc.onmessage({ data: JSON.parse(event.data) });
  }
});

const INTREBARI_RUNDA_1 = 15;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genereazaRunde() {
  const amestecate = shuffle(toateIntrebarile);
  const runda1 = amestecate.slice(0, INTREBARI_RUNDA_1);
  const runda2 = amestecate.slice(INTREBARI_RUNDA_1);
  return [
    { nume: "RUNDA 1 (Primul Meci)", intrebari: runda1 },
    { nume: "RUNDA 2 (Al Doilea Meci)", intrebari: runda2 },
  ];
}

let bazaDeDateJoc = genereazaRunde();

//sunete
const sunetCorect = new Audio("./sunete/corect.mp3");
const sunetBuzzer = new Audio("./sunete/buzzer.mp3");
const sunetWin = new Audio("./sunete/win.mp3");
const sunetClap = new Audio("./sunete/clap.mp3");
const sunetBoo = new Audio("./sunete/booo.mp3");
const sunetIntro = new Audio("./sunete/intro.mp3");

function playManualSound(tip) {
  if (tip === "intro") {
    sunetIntro.currentTime = 0;
    sunetIntro.play();
  }
  if (tip === "clap") {
    sunetClap.currentTime = 0;
    sunetClap.play();
  }
  if (tip === "boo") {
    sunetBoo.currentTime = 0;
    sunetBoo.play();
  }
}

let stare = {
  t1: "Echipa 1",
  t2: "Echipa 2",
  s1: 0,
  s2: 0,
  bank: 0,
  turn: 1,
  initial: 1,
  strikes: 0,
  steal: false,
  roundIdx: 0,
  qIdx: 0,
  revealed: [],
  qVis: false,
  roundFinished: false,
  gameFinished: false,
};

let intrebareCurenta = null;

window.onload = () => {
  incarcaStareDinMemorie();
};

function salveazaStare() {
  localStorage.setItem("iswintFeudState", JSON.stringify(stare));
}

function salveazaRunde() {
  localStorage.setItem("iswintFeudRunde", JSON.stringify(bazaDeDateJoc));
}

function incarcaStareDinMemorie() {
  const rundeSalvate = localStorage.getItem("iswintFeudRunde");
  if (rundeSalvate) {
    bazaDeDateJoc = JSON.parse(rundeSalvate);
  } else {
    salveazaRunde();
  }

  let salvat = localStorage.getItem("iswintFeudState");
  if (salvat) {
    stare = JSON.parse(salvat);

    document.getElementById("t1-name").value = stare.t1;
    document.getElementById("t2-name").value = stare.t2;
    document.getElementById("lbl-turn1").innerText = stare.t1;
    document.getElementById("lbl-turn2").innerText = stare.t2;
    document.getElementById("host-bank").innerText = stare.bank;
    document.getElementById("turn" + stare.turn).checked = true;

    actualizeazaInterfataIntrebare();

    if (!stare.roundFinished && !stare.gameFinished) {
      deseneazaButoaneRaspuns();
      stare.revealed.forEach((id) => {
        let btn = document.getElementById("btn-ans-" + id);
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = 0.5;
        }
      });
      if (stare.steal) showStatus(`(Recuperat) Rândul este la Furt!`);
      else if (stare.strikes > 0)
        showStatus(`(Recuperat) Echipa curentă are ${stare.strikes} X-uri!`);
    }
  } else {
    actualizeazaInterfataIntrebare();
    salveazaStare();
  }
  setTimeout(sincronizeazaPublic, 300);
}

canalJoc.onmessage = (event) => {
  if (event.data.actiune === "cere_sincronizare") sincronizeazaPublic();
};

function sincronizeazaPublic() {
  canalJoc.postMessage({
    actiune: "update_teams",
    t1Name: stare.t1,
    t2Name: stare.t2,
  });
  canalJoc.postMessage({
    actiune: "update_scores",
    s1: stare.s1,
    s2: stare.s2,
  });
  canalJoc.postMessage({ actiune: "update_bank", bank: stare.bank });
  canalJoc.postMessage({ actiune: "set_active_team", team: stare.turn });

  if (stare.roundFinished) {
    afiseazaCastigatorPePublic();
    return;
  }
  if (
    !intrebareCurenta ||
    (stare.revealed.length === 0 && !stare.qVis && stare.strikes === 0)
  )
    return;

  canalJoc.postMessage({
    actiune: "setup_board",
    numarRaspunsuri: intrebareCurenta.raspunsuri.length,
  });
  if (stare.qVis)
    canalJoc.postMessage({
      actiune: "show_question",
      text: intrebareCurenta.intrebare,
    });

  stare.revealed.forEach((id) => {
    let r = intrebareCurenta.raspunsuri[id - 1];
    canalJoc.postMessage({
      actiune: "arata_raspuns",
      id: id,
      text: r.text,
      puncte: r.puncte,
    });
  });
  for (let i = 0; i < stare.strikes; i++)
    canalJoc.postMessage({ actiune: "strike" });
}

function updateTeams() {
  stare.t1 = document.getElementById("t1-name").value || "Echipa 1";
  stare.t2 = document.getElementById("t2-name").value || "Echipa 2";
  document.getElementById("lbl-turn1").innerText = stare.t1;
  document.getElementById("lbl-turn2").innerText = stare.t2;
  salveazaStare();
  canalJoc.postMessage({
    actiune: "update_teams",
    t1Name: stare.t1,
    t2Name: stare.t2,
  });
}

function changeTurn(team) {
  stare.turn = team;
  document.getElementById("turn" + team).checked = true;
  salveazaStare();
  canalJoc.postMessage({ actiune: "set_active_team", team: stare.turn });
}

function deseneazaButoaneRaspuns() {
  const answersPanel = document.getElementById("answers-panel");
  answersPanel.innerHTML = "";
  intrebareCurenta.raspunsuri.forEach((rasp, index) => {
    const id = index + 1;
    answersPanel.innerHTML += `<button id="btn-ans-${id}" style="width:100%; margin-bottom:5px; text-align:left;" onclick="revealAnswer(${id}, '${rasp.text}', ${rasp.puncte}, this)">
                    ${id}. ${rasp.text} (${rasp.puncte} pct)
                </button>`;
  });
}

function incarcaIntrebareCurenta() {
  stare.strikes = 0;
  stare.steal = false;
  stare.revealed = [];
  stare.qVis = false;
  document.getElementById("status-message").style.display = "none";
  deseneazaButoaneRaspuns();
  salveazaStare();
  canalJoc.postMessage({
    actiune: "setup_board",
    numarRaspunsuri: intrebareCurenta.raspunsuri.length,
  });
}

function sendQuestion() {
  stare.qVis = true;
  salveazaStare();
  canalJoc.postMessage({
    actiune: "show_question",
    text: intrebareCurenta.intrebare,
  });
}

function revealAnswer(id, text, puncte, btnElement) {
  btnElement.disabled = true;
  btnElement.style.opacity = 0.5;

  sunetCorect.currentTime = 0;
  sunetCorect.play();

  stare.bank += puncte;
  stare.revealed.push(id);
  document.getElementById("host-bank").innerText = stare.bank;
  salveazaStare();

  canalJoc.postMessage({
    actiune: "arata_raspuns",
    id: id,
    text: text,
    puncte: puncte,
  });
  canalJoc.postMessage({ actiune: "update_bank", bank: stare.bank });

  if (stare.steal) {
    // Echipa care fură a răspuns corect
    let stealingName = stare.turn === 1 ? stare.t1 : stare.t2;
    awardBankTo(stare.turn);
    stare.steal = false;
    stare.strikes = 0;
    salveazaStare();
    showStatus(`✅ Furt Reușit! ${stealingName} a câștigat toate punctele din bancă.`);
  } else {
    if (stare.revealed.length === intrebareCurenta.raspunsuri.length) {
      let activeName = stare.turn === 1 ? stare.t1 : stare.t2;
      awardBankTo(stare.turn);
      showStatus(`👏 Fantastic! ${activeName} a ghicit tot panoul!`);
    }
  }
}

function giveStrike() {
  sunetBuzzer.currentTime = 0;
  sunetBuzzer.play();

  if (!stare.steal) {
    stare.strikes++;
    salveazaStare();
    canalJoc.postMessage({ actiune: "strike" });

    if (stare.strikes >= 3) {
      stare.steal = true;
      stare.initial = stare.turn;
      let stealingTeam = stare.turn === 1 ? 2 : 1;
      let stealingName = stealingTeam === 1 ? stare.t1 : stare.t2;
      changeTurn(stealingTeam);
      showStatus(
        `Atenție: 3 X-uri! Rândul a trecut la ${stealingName} pentru a fura punctele!`,
      );
    }
  } else {
    // Echipa care fură a răspuns greșit
    canalJoc.postMessage({ actiune: "strike" });
    let originalName = stare.initial === 1 ? stare.t1 : stare.t2;
    awardBankTo(stare.initial);
    stare.steal = false;
    stare.strikes = 0;
    changeTurn(stare.initial);
    salveazaStare();
    showStatus(
      `❌ Furt Eșuat! ${originalName} (echipa inițială) primește punctele.`,
    );
  }
}

function awardBankTo(team) {
  if (team === 1) stare.s1 += stare.bank;
  else stare.s2 += stare.bank;
  stare.bank = 0;
  document.getElementById("host-bank").innerText = stare.bank;
  salveazaStare();
  canalJoc.postMessage({ actiune: "update_bank", bank: stare.bank });
  canalJoc.postMessage({
    actiune: "update_scores",
    s1: stare.s1,
    s2: stare.s2,
  });
}

function actualizeazaInterfataIntrebare() {
  let runda = bazaDeDateJoc[stare.roundIdx];
  intrebareCurenta = runda.intrebari[stare.qIdx];

  document.getElementById("round-indicator").innerText = `🗂️ ${runda.nume}`;
  document.getElementById("q-counter").innerText =
    `${stare.qIdx + 1} / ${runda.intrebari.length}`;
  document.getElementById("host-q-text").innerText = intrebareCurenta.intrebare;

  const btnNext = document.getElementById("btn-next");

  if (stare.gameFinished) {
    btnNext.disabled = true;
    btnNext.innerHTML = "🏁 Toate Meciurile s-au încheiat!";
    btnNext.style.backgroundColor = "#29712a";
    btnNext.style.color = "white";
    document.getElementById("answers-panel").innerHTML =
      "<i>Eveniment Finalizat</i>";
  } else if (stare.roundFinished) {
    btnNext.disabled = false;
    btnNext.innerHTML = `🔄 Începe Joc Nou: ${bazaDeDateJoc[stare.roundIdx + 1].nume}`;
    btnNext.style.backgroundColor = "#ffdf00";
    btnNext.style.color = "#7d3795";
    document.getElementById("answers-panel").innerHTML =
      "<i>Așteaptă începerea meciului următor...</i>";
  } else if (stare.qIdx < runda.intrebari.length - 1) {
    btnNext.disabled = false;
    btnNext.innerHTML = "⏭️ 3. Treci la Următoarea Întrebare";
    btnNext.style.backgroundColor = "#333";
    btnNext.style.color = "white";
    document.getElementById("answers-panel").innerHTML =
      '<i>Apasă "Pregătește Runda pe Ecran" pentru a încărca...</i>';
  } else {
    btnNext.disabled = false;
    btnNext.innerHTML = "🏆 3. Afișează Câștigătorii Meciului";
    btnNext.style.backgroundColor = "#29712a";
    btnNext.style.color = "white";
    document.getElementById("answers-panel").innerHTML =
      '<i>Ultima întrebare a meciului. Apasă "Pregătește" pentru a juca.</i>';
  }
}

function urmatoareaFaza() {
  let rundaCurenta = bazaDeDateJoc[stare.roundIdx];
  if (stare.gameFinished) return;

  if (stare.roundFinished) {
    stare.roundIdx++;
    stare.qIdx = 0;
    stare.roundFinished = false;

    stare.s1 = 0;
    stare.s2 = 0;
    stare.t1 = "Echipa 1";
    stare.t2 = "Echipa 2";
    document.getElementById("t1-name").value = stare.t1;
    document.getElementById("t2-name").value = stare.t2;

    stare.strikes = 0;
    stare.steal = false;
    stare.revealed = [];
    stare.qVis = false;
    stare.bank = 0;

    actualizeazaInterfataIntrebare();
    salveazaStare();

    canalJoc.postMessage({
      actiune: "update_teams",
      t1Name: stare.t1,
      t2Name: stare.t2,
    });
    canalJoc.postMessage({ actiune: "update_scores", s1: 0, s2: 0 });
    canalJoc.postMessage({ actiune: "clear_screen" });

    changeTurn(1);
    return;
  }

  stare.strikes = 0;
  stare.steal = false;
  stare.revealed = [];
  stare.qVis = false;
  stare.bank = 0;
  document.getElementById("host-bank").innerText = "0";
  document.getElementById("status-message").style.display = "none";

  if (stare.qIdx < rundaCurenta.intrebari.length - 1) {
    stare.qIdx++;
    actualizeazaInterfataIntrebare();
    salveazaStare();
    canalJoc.postMessage({ actiune: "clear_screen" });
  } else {
    stare.roundFinished = true;
    if (stare.roundIdx === bazaDeDateJoc.length - 1) {
      stare.gameFinished = true;
    }
    actualizeazaInterfataIntrebare();
    salveazaStare();
    afiseazaCastigatorPePublic();
  }

  canalJoc.postMessage({ actiune: "update_bank", bank: 0 });
}

function afiseazaCastigatorPePublic() {
  sunetWin.currentTime = 0;
  sunetWin.play();

  let wName,
    lName,
    wScore,
    lScore,
    diff,
    isTie = false;
  if (stare.s1 > stare.s2) {
    wName = stare.t1;
    wScore = stare.s1;
    lName = stare.t2;
    lScore = stare.s2;
  } else if (stare.s2 > stare.s1) {
    wName = stare.t2;
    wScore = stare.s2;
    lName = stare.t1;
    lScore = stare.s1;
  } else {
    isTie = true;
    wScore = stare.s1;
  }
  diff = wScore - lScore;
  canalJoc.postMessage({
    actiune: "show_winner",
    winner: wName,
    loser: lName,
    wScore: wScore,
    lScore: lScore,
    diff: diff,
    tie: isTie,
  });
}

function resetJocTotal() {
  if (
    confirm(
      "⚠ Ești sigur? Se vor șterge TOATE scorurile și o luăm de la zero! Întrebările vor fi amestecate din nou.",
    )
  ) {
    localStorage.removeItem("iswintFeudState");
    localStorage.removeItem("iswintFeudRunde");
    canalJoc.postMessage({ actiune: "clear_screen" });
    location.reload();
  }
}

function showStatus(msg) {
  const statusDiv = document.getElementById("status-message");
  statusDiv.style.display = "block";
  statusDiv.innerText = msg;
}
