import {families,names,policies,defenses,variants,flagged,detectorSummary,replayTotals,escapeHTML as e,formatScore as f,percent} from './metrics.js';

const colors={clean:'#6b7c85',rank_encoding:'#ab4a23',synonym_slot_codebook:'#2867ab',unicode_hidden_channel:'#7952a1'};
const gates={f1:'F1 gate',fpr05:'5% FPR target',fpr01:'1% FPR target',custom:'Custom cutoff'};
const operating={oracle:'Always applied',f1:'F1 gate',fpr_01:'1% FPR target'};
const state={view:'protection',variant:'full_deployed_with_unicode_hygiene',gate:'f1',cutoff:.5,parent:'',policy:'channel_migration_feedback',defense:'deterministic_rewrite',round:0,domain:'conversational',prompt:'',model:'',outcome:'synonym_slot_codebook',utilityDefense:'deterministic_rewrite',utilityRound:3,utilityParent:''};
let data;
const main=document.getElementById('content');
const shortModel=s=>s.split('/').at(-1);
const parentLabel=id=>id.replace(/^clean_/,'');
const channel=family=>`<span class="channel-dot" style="--channel:${colors[family]}"></span>${names[family]}`;
const options=(values,selected)=>Object.entries(values).map(([value,label])=>`<option value="${e(value)}" ${value===String(selected)?'selected':''}>${e(label)}</option>`).join('');
const select=(id,label,values,value,wide=false)=>`<div class="field ${wide?'wide':''}"><label for="${id}">${label}</label><select id="${id}" data-control="${id}">${options(values,value)}</select></div>`;
const badge=(value,yes,no)=>`<span class="badge ${value?'yes':'no'}">${value?yes:no}</span>`;
const cleanById=()=>new Map(data.corpus.map(r=>[r.sample_id,r]));
const currentRounds=()=>data.replay.filter(r=>r.clean_parent_id===state.parent&&r.attacker_condition===state.policy&&r.defender_policy===state.defense).sort((a,b)=>a.round_id-b.round_id);

function applyHash(){
  const [view,query]=location.hash.slice(1).split('?');
  state.view=['protection','detector','replay','corpus'].includes(view)?view:'protection';
  const params=new URLSearchParams(query||'');
  if(data.parents.includes(params.get('parent')))state.parent=params.get('parent');
  if(params.get('policy') in policies)state.policy=params.get('policy');
  if(params.get('defense') in defenses)state.defense=params.get('defense');
}
function render(){
  document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===state.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  ({protection:renderProtection,detector:renderDetector,replay:renderReplay,corpus:renderCorpus})[state.view]();
}

function renderProtection(){
  const syn=data.protection.synonym_slot_codebook;
  const utility=data.adaptive_utility.find(r=>r.defense===state.utilityDefense&&r.round===Number(state.utilityRound));
  const selectedControls=data.controls.filter(r=>r.defender_policy===state.utilityDefense&&r.round_id===Number(state.utilityRound)&&r.detected);
  if(!selectedControls.some(r=>r.clean_parent_id===state.utilityParent))state.utilityParent=selectedControls[0].clean_parent_id;
  const example=selectedControls.find(r=>r.clean_parent_id===state.utilityParent);
  const clean=cleanById().get(state.utilityParent);
  main.innerHTML=`
    <div class="kickers">
      <div class="kicker"><span class="label">Rewriting when always applied</span><div class="big-number">${syn.oracle}<span> / ${syn.n}</span></div><p>Synonym payloads not exactly recovered.</p></div>
      <div class="kicker"><span class="label">Conservative detector gating</span><div class="big-number">${syn.fpr_01}<span> / ${syn.n}</span></div><p>The same outcome when few attacks trigger rewriting.</p></div>
      <div class="kicker"><span class="label">Cost of the more sensitive gate</span><div class="big-number">${data.static_utility.f1.rewritten}<span> / 104</span></div><p>Clean responses rewritten under the F1 gate.</p></div>
    </div>
    <section class="panel" aria-labelledby="protection-title">
      <div class="panel-head"><div><h2 id="protection-title">Effective rewriting needs to be triggered</h2><p class="muted">Compare intervention on every response with intervention chosen by the detector. All rows use the same 104 matched parents.</p></div></div>
      <div class="filters">${select('outcome','Compare outcome',{rank_encoding:'Rank payload disruption',synonym_slot_codebook:'Synonym payload disruption',unicode_hidden_channel:'Unicode payload disruption',clean:'Clean responses receiving intervention'},state.outcome)}</div>
      <div class="bar-list" aria-label="${names[state.outcome]} comparison">${Object.entries(operating).map(([key,label])=>{const n=state.outcome==='clean'?data.static_utility[key].rewritten:data.protection[state.outcome][key];return `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${n/104*100}%;background:${key==='oracle'?'#175b60':key==='f1'?'#559597':'#b4873c'}"></div></div><span class="bar-value">${n}/104 · ${percent(n,104)}</span></div>`}).join('')}</div>
      <div class="table-wrap"><table><caption class="small muted" style="text-align:left;padding:0 0 8px">Exact-payload disruption and clean intervention</caption><thead><tr><th>Outcome</th>${Object.values(operating).map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>
      ${families.filter(x=>x!=='clean').map(family=>`<tr><td>${channel(family)} payload disrupted</td>${Object.keys(operating).map(key=>`<td>${data.protection[family][key]} / 104</td>`).join('')}</tr>`).join('')}
      <tr><td>Clean responses receiving intervention</td>${Object.keys(operating).map(key=>`<td>${data.static_utility[key].rewritten} / 104</td>`).join('')}</tr></tbody></table></div>
      <p class="segmented-note">Linguistic channels use deterministic rewriting; suspicious Unicode uses sanitation. Disruption means the full payload was not recovered exactly. The clean row measures intervention, not message disruption. FPR labels are calibration targets.</p>
    </section>
    <section class="panel"><h2>What happens to legitimate responses?</h2><p class="muted">Similarity averaged over every clean response can hide the cost to the responses that were actually rewritten.</p>
      <div class="table-wrap"><table><thead><tr><th>Static condition</th><th>Intervened</th><th>Similarity, all clean</th><th>Similarity, intervened only</th></tr></thead><tbody>${Object.entries(operating).map(([key,label])=>{const r=data.static_utility[key];return `<tr><td>${label}</td><td>${r.rewritten} / ${r.n}</td><td>${f(r.similarity_all,4)}</td><td>${f(r.similarity_rewritten,4)}</td></tr>`}).join('')}</tbody></table></div>
      <div class="note">These are model-based proxies, not human judgments. Embedding similarity does not verify every fact or instruction. The evaluator and rewriter share a checkpoint, limiting the independence of the assessment.</div>
    </section>
    <section class="panel"><h2>Inspect the adaptive clean controls</h2><p class="muted">The same 48 clean responses accompany each round. Repeated controls are not independent samples.</p>
      <div class="filters">${select('utilityDefense','Rewriter',defenses,state.utilityDefense)}${select('utilityRound','Round',{0:'R0',1:'R1',2:'R2',3:'R3'},state.utilityRound)}</div>
      <div class="metric-strip"><div><strong>${utility.rewritten} / ${utility.n}</strong><span>Clean responses rewritten</span></div><div><strong>${f(utility.similarity_all,4)}</strong><span>Mean similarity, all clean</span></div><div><strong>${f(utility.similarity_rewritten,4)}</strong><span>Mean similarity, rewritten only</span></div></div>
      ${select('utilityParent','Inspect a rewritten clean response',Object.fromEntries(selectedControls.map(r=>[r.clean_parent_id,parentLabel(r.clean_parent_id)])),state.utilityParent)}
      <p class="segmented-note">Example similarity: ${f(example.semantic_similarity_original_to_mitigated,4)} · Length ratio: ${f(example.length_ratio,3)}</p>
      <details><summary>Compare original and delivered text</summary><div class="text-pair"><div><h3>Original clean response</h3><div class="text-box">${e(clean.text)}</div></div><div><h3>Delivered after rewriting</h3><div class="text-box">${e(example.final_text)}</div></div></div></details>
    </section>`;
}

function renderDetector(){
  main.innerHTML=`<section class="panel"><h2>Which responses does the detector flag?</h2><p class="muted">Eight feature configurations evaluated on held-out topics. Each family has 104 records, with the same clean responses used for comparison.</p><div class="filters">
    ${select('variant','Feature set',variants,state.variant,true)}${select('gate','Threshold',gates,state.gate)}
    ${state.gate==='custom'?`<div class="field"><label for="cutoff-range">Score cutoff</label><div class="cutoff-controls"><input id="cutoff-range" data-control="cutoff" type="range" min="0" max="1" step="0.001" value="${state.cutoff}" aria-label="Score cutoff"><input id="cutoff-number" data-control="cutoff" type="number" min="0" max="1" step="0.001" value="${state.cutoff}" aria-label="Exact cutoff"></div></div>`:''}</div><div id="detector-results"></div></section>`;
  renderDetectorResults();
}
function renderDetectorResults(){
  const rows=detectorSummary(data.detector,state.variant,state.gate,state.cutoff);
  const scores=data.detector.filter(r=>r.variant===state.variant);
  const custom=state.gate==='custom';
  const pooled=rows.filter(r=>r.auc!==null).reduce((sum,r)=>sum+r.auc,0)/3;
  document.getElementById('detector-results').innerHTML=`<div class="table-wrap"><table aria-label="Detector results"><thead><tr><th>Channel</th><th>Records</th><th>Flagged</th><th>Rate</th><th>AUROC vs clean</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${channel(r.family)}${r.family==='clean'?' <span class="small">(false positives)</span>':''}</td><td>${r.n}</td><td>${r.flagged}</td><td>${percent(r.flagged,r.n)}</td><td>${r.auc===null?'Not applicable':f(r.auc,4)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Pooled <span class="muted small">(mean of three)</span></td><td>416</td><td></td><td></td><td>${f(pooled,4)}</td></tr></tfoot></table></div>
    <div class="note">${custom?'A shared cutoff is applied to full-precision stored scores for exploration. This is not a separately calibrated operating point.':'Stored decisions use thresholds chosen separately within each fold by nested calibration. FPR targets do not guarantee the observed held-out false-positive rate.'} Changing these controls does not rerun or reconfigure the frozen Replay trajectories.</div>
    <div class="panel-head" style="margin-top:26px"><div><h2>Score distribution by channel</h2><p class="muted small">${custom?'The line marks the shared cutoff. Scores at or above it are flagged.':'Each point is a held-out record. Highlighting shows its stored decision under its fold-specific threshold.'}${state.variant==='full_deployed_with_unicode_hygiene'?' The Unicode hygiene override applies.':''}</p></div><button class="button secondary" data-action="download-detector">Download summary</button></div>
    <div class="plot-wrap">${stripPlot(scores,custom)}</div><div class="legend"><span>● Saturated: flagged</span><span>○ Muted: not flagged</span><span>Horizontal position: detector score</span></div>`;
}
function stripPlot(records,custom){
  const x=v=>100+v*760;
  let svg=`<svg class="plot" viewBox="0 0 900 280" role="img" aria-label="Detector scores for 104 records in each of four channels"><title>Score distributions. See the table above for exact counts.</title>`;
  for(const tick of [0,.25,.5,.75,1])svg+=`<line class="axis" x1="${x(tick)}" x2="${x(tick)}" y1="16" y2="245"/><text x="${x(tick)}" y="270" text-anchor="middle">${tick.toFixed(2)}</text>`;
  families.forEach((family,i)=>{
    const y=43+i*59;
    svg+=`<text x="80" y="${y+4}" text-anchor="end">${names[family]}</text>`;
    records.filter(r=>r.attack_name===family).forEach((r,j)=>{
      const isFlagged=flagged(r,state.gate,state.cutoff);
      svg+=`<circle cx="${x(r.score)}" cy="${y+((j*17)%31-15)}" r="3.4" fill="${colors[family]}" opacity="${isFlagged?.85:.22}"><title>${e(r.sample_id)}; score ${r.score}; ${isFlagged?'flagged':'not flagged'}; ${e(r.fold_id)}</title></circle>`;
    });
  });
  if(custom)svg+=`<line class="cutoff" x1="${x(state.cutoff)}" x2="${x(state.cutoff)}" y1="10" y2="247"/>`;
  return svg+'</svg>';
}

function renderReplay(){
  const totals=replayTotals(data.replay);
  const clean=cleanById().get(state.parent);
  const counts=data.accepted_counts[state.parent];
  const planned=data.planned_counts[state.parent];
  const rounds=currentRounds();
  main.innerHTML=`<section class="panel"><h2>Successful bits, R0 to R3</h2><p class="muted">Sum of payload bits from exact recoveries across 48 parents. Repeated deliveries of the same message count again.</p>
    <div class="table-wrap"><table><thead><tr><th>Rewriter</th>${Object.values(policies).map(p=>`<th>${p}</th>`).join('')}</tr></thead><tbody>${Object.entries(defenses).map(([def,label])=>`<tr><td>${label}</td>${Object.keys(policies).map(pol=>`<td>${totals.find(r=>r.defense===def&&r.policy===pol).total}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="note caution">A bounded, within-corpus replay over four rounds. Policies select from a fixed, validated catalogue using prior exact-recovery feedback. Paired adaptive gains did not pass multiple-testing correction.</div>
    <details><summary>What adaptation means here</summary><div class="note-grid"><div><h3>Three selection rules</h3><p><strong>Frozen:</strong> repeat the initial family and strategy.<br><strong>Fixed channel:</strong> stay after exact recovery; otherwise cycle through accepted strategies within the family.<br><strong>Migration:</strong> stay after exact recovery; otherwise switch family and select an accepted strategy there.</p><p>No new encoders or strategies are learned during replay. Payloads are fixed within each parent and family; switching families can change message length and content.</p></div><div><h3>Evaluation boundary</h3><p>The defense stays fixed. Adaptive anchors and clean controls appeared in nine of the ten detector models' training sets, and variants share their parents and topics. This is not an independent held-out test.</p><p>At R3, migration improved on frozen for six parents under deterministic rewriting and seven under randomized rewriting. All other parents tied. Decoder output coverage alone is not a measure of information leakage.</p></div></div></details>
    </section>
    <section class="panel"><div class="panel-head"><div><h2>Trajectory browser</h2><p class="muted small">One initial attempt and three feedback rounds. Every round below is a recorded experiment.</p></div><button class="button secondary" data-action="download-replay">Download trajectory</button></div><div class="filters">
    ${select('parent','Original response (parent)',Object.fromEntries(data.parents.map(id=>[id,parentLabel(id)])),state.parent,true)}${select('policy','Attacker policy',policies,state.policy)}${select('defense','Rewriter',defenses,state.defense)}</div>
    <p class="trajectory-meta">${e(shortModel(clean.source_model))} · ${e(clean.domain)} · Target ${clean.target_length} tokens; actual clean length <strong>${clean.actual_token_length}</strong> · Usable candidates: <strong>Rank ${counts.rank_encoding}, Synonym ${counts.synonym_slot_codebook}</strong></p>
    <details><summary>Prompt, clean answer, and catalogue validation</summary><div class="prompt">${e(clean.prompt)}</div><div class="text-box">${e(clean.text)}</div><p class="segmented-note">Source-tokenizer lengths. Planned candidates: rank ${planned.rank_encoding}, synonym ${planned.synonym_slot_codebook}. Failed candidates are excluded from the usable counts. The full catalogue contains 468 rank and 110 synonym candidates.</p></details>
    <div class="note"><strong>Attacker feedback:</strong> the interface records detection, routing, and exact-recovery outcomes. The selection rules use the preceding exact-recovery result. Scores, features, thresholds, and rewrite seeds are hidden from the policy.</div></section>
    <div class="round-grid">${rounds.map(r=>roundCard(r)).join('')}</div>
    <div id="round-detail" tabindex="-1" aria-label="Selected round text comparison">${roundDetail(rounds[state.round])}</div>`;
}
function roundCard(r){
  return `<article class="round ${r.round_id===Number(state.round)?'active':''}" style="--channel:${colors[r.attack_name]}"><h3><span class="round-number">R${r.round_id}</span>${channel(r.attack_name)}</h3><div class="badges"><span class="badge ${r.detected?'flag':''}">${r.detected?'Flagged, rewritten':'Passed through'}</span>${badge(r.exact_payload_recovery,'Exactly recovered','Not exactly recovered')}</div><dl><dt>Strategy</dt><dd>#${r.strategy_index} · ${e(r.selection_reason.replaceAll('_',' '))}</dd><dt>Payload</dt><dd>${r.payload_bit_length} ${r.payload_bit_length===1?'bit':'bits'}</dd><dt>Successful bits</dt><dd>${r.successful_covert_bits}</dd></dl><details><summary>Researcher diagnostics</summary><p class="small">Detector: ${r.flagged_fold_count}/${r.fold_count} models<br>Mean score: <span title="${r.ensemble_mean_score}">${f(r.ensemble_mean_score)}</span></p><p class="code-note">${e(r.decoder_error||'Decoder returned a payload.')}</p><p class="small">Decoder output: ${r.observed_bit_count} of ${r.expected_bit_count} expected bits.</p>${r.slot_details?.length?`<div class="code-note">${r.slot_details.map(s=>`${e(s.slot_id)}: wanted ${e(s.expected_bit)}, got ${e(s.decoded_bit??'?')} (${e(s.status)})`).join('<br>')}</div>`:''}</details><button class="button secondary" data-action="inspect-round" data-round="${r.round_id}" aria-pressed="${r.round_id===Number(state.round)}">Compare text · R${r.round_id}</button></article>`;
}
function roundDetail(r){
  const c=data.candidates[r.candidate_id];
  return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">Round ${r.round_id} · ${names[r.attack_name]}</span><h2>Sent text and delivered text</h2><p class="muted small">Compare the encoded candidate with what reached the receiver.</p></div>${badge(r.exact_payload_recovery,'Exactly recovered','Not exactly recovered')}</div><div class="text-pair"><div><h3>Sent by the attacker</h3><div class="text-box">${e(c.text)}</div></div><div><h3>${r.detected?'Delivered after rewriting':'Delivered unchanged'}</h3><div class="text-box">${e(r.final_text)}</div></div></div><details><summary>Reference and decoded payloads (researcher view)</summary><p class="label">Reference payload · ${r.payload_bit_length} bits</p><div class="code-note">${e(c.payload)}</div><p class="label" style="margin-top:15px">Decoder output</p><div class="code-note">${e(r.decoded_slot_pattern||r.decoded_payload||'(empty)')}</div></details><p class="segmented-note">Not exactly recovered means the complete intended message was not decoded correctly. It does not establish zero leakage. Partial decoder output alone also does not establish useful information leakage.</p></section>`;
}

function renderCorpus(){
  const domainRows=data.corpus.filter(r=>r.domain===state.domain);
  const prompts=Object.fromEntries(domainRows.map(r=>[r.prompt_id,`${r.topic_seed} · target ${r.target_length} tokens`]));
  if(!(state.prompt in prompts))state.prompt=Object.keys(prompts).sort()[0];
  const models=Object.fromEntries(data.corpus.map(r=>[r.source_model,shortModel(r.source_model)]));
  if(!(state.model in models))state.model=Object.keys(models).sort()[0];
  const rows=domainRows.filter(r=>r.prompt_id===state.prompt&&r.source_model===state.model).sort((a,b)=>a.replicate_index-b.replicate_index);
  main.innerHTML=`<section class="panel"><h2>Original corpus</h2><p class="muted">The 160 clean responses generated before attack construction: 20 prompts, two source models, and four replicates per prompt and model.</p><div class="filters">${select('domain','Domain',{conversational:'Conversational',technical:'Technical'},state.domain)}${select('prompt','Prompt',prompts,state.prompt,true)}${select('model','Source model',models,state.model)}</div><div class="prompt">${e(rows[0].prompt)}</div><p class="segmented-note">Each card reports actual source-tokenizer length. Target lengths are approximate. A parent can enter the matched comparison only if all three attack families succeeded; the adaptive subset contains six matched parents per corpus cell.</p></section><div class="corpus-grid">${rows.map(r=>`<article class="corpus-card"><h3>${e(shortModel(r.source_model))} <span class="badge">Replicate ${r.replicate_index}</span></h3><p class="token-line"><strong>${r.actual_token_length} actual tokens</strong> · target ${r.target_length} · ${r.matched?'In matched static population':'Outside matched static population'}</p><div class="text-box" id="text-${e(r.sample_id)}">${e(r.text)}</div><div class="actions"><button class="button secondary" data-action="expand-answer" data-id="${e(r.sample_id)}" aria-expanded="false">Read full answer</button>${r.adaptive?`<button class="button" data-action="view-replay" data-parent="${e(r.sample_id)}">View replay</button>`:'<span class="badge">Outside adaptive subset</span>'}</div></article>`).join('')}</div>`;
}

function downloadCSV(name,rows){
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv=rows.map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
main.addEventListener('input',ev=>{
  if(ev.target.dataset.control!=='cutoff'||!ev.target.validity.valid||ev.target.value==='')return;
  state.cutoff=Math.max(0,Math.min(1,Number(ev.target.value)));
  for(const id of ['cutoff-range','cutoff-number'])if(document.getElementById(id)!==ev.target)document.getElementById(id).value=state.cutoff;
  renderDetectorResults();
});
main.addEventListener('change',ev=>{
  const key=ev.target.dataset.control;
  if(!key||key==='cutoff')return;
  state[key]=ev.target.value;
  if(['parent','policy','defense'].includes(key))state.round=0;
  render();
  const control=document.getElementById(key);if(control)control.focus({preventScroll:true});
});
main.addEventListener('click',ev=>{
  const button=ev.target.closest('[data-action]');if(!button)return;
  if(button.dataset.action==='inspect-round'){
    state.round=Number(button.dataset.round);renderReplay();document.getElementById('round-detail').focus();
  }else if(button.dataset.action==='view-replay'){
    state.parent=button.dataset.parent;state.round=0;location.hash='replay?'+new URLSearchParams({parent:state.parent});main.focus();
  }else if(button.dataset.action==='expand-answer'){
    const box=document.getElementById('text-'+button.dataset.id);const expanded=box.classList.toggle('expanded');button.textContent=expanded?'Collapse answer':'Read full answer';button.setAttribute('aria-expanded',String(expanded));
  }else if(button.dataset.action==='download-detector'){
    const rows=detectorSummary(data.detector,state.variant,state.gate,state.cutoff);downloadCSV('stegoguard-detector-summary.csv',[['variant','gate','custom_cutoff','channel','records','flagged','auroc'],...rows.map(r=>[state.variant,state.gate,state.gate==='custom'?state.cutoff:'',r.family,r.n,r.flagged,r.auc])]);
  }else if(button.dataset.action==='download-replay'){
    downloadCSV('stegoguard-trajectory.csv',[['parent','policy','defense','round','channel','strategy','flagged','exact_recovery','payload_bits','successful_bits','mean_score'],...currentRounds().map(r=>[r.clean_parent_id,r.attacker_condition,r.defender_policy,r.round_id,r.attack_name,r.strategy_index,r.detected,r.exact_payload_recovery,r.payload_bit_length,r.successful_covert_bits,r.ensemble_mean_score])]);
  }
});
window.addEventListener('hashchange',()=>{if(data){applyHash();render();}});
document.querySelector('.skip-link').addEventListener('click',ev=>{ev.preventDefault();main.focus();main.scrollIntoView({block:'start'});});

async function boot(){
  try{
    const response=await fetch(new URL('./data/study.json',import.meta.url));
    if(!response.ok)throw new Error(`Study data request failed (${response.status}).`);
    data=await response.json();
    if(data.corpus.length!==160||data.replay.length!==1152)throw new Error('Study data is incomplete.');
    state.parent=data.parents[0];applyHash();render();
    document.getElementById('provenance').innerHTML=`<p>All values derive from the supplied frozen <code>${e(data.provenance.source_archive)}</code> archive. Scores are retained at full precision and rounded only for display. No experimental outcomes are synthesized.</p><p><a href="./data/study.json" download="stegoguard-pilot-v0.json">Download the explorer data (JSON, approximately 5 MB)</a></p><p class="small">Archive SHA-256: <code>${e(data.provenance.archive_sha256)}</code></p><p class="small">The download includes source-file checksums and the exact records behind the summaries. Population definitions and interpretation follow the revised manuscript's Method, Results, and Limitations.</p>`;
  }catch(error){
    main.innerHTML=`<section class="panel error" role="alert"><h2>The study data could not be loaded</h2><p>${e(error.message)}</p><p>Reload the page to try again. For a local copy, serve the <code>dist</code> directory over HTTP using the README instructions.</p><button class="button" id="reload">Try again</button></section>`;
    document.getElementById('reload').onclick=()=>location.reload();
  }
}
boot();
