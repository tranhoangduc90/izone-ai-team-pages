(function () {
  'use strict';
  const slot=n=>`<span class="cbt-inline-answer" data-answer-slot="${n}"></span>`;
  const numbered=n=>`<span class="cbt-answer-control" data-question-number="${n}"><strong class="cbt-blank-number">${n}</strong>${slot(n)}</span>`;
  const question=(n,text)=>`<div class="cbt-question-card" data-question-number="${n}"><div class="cbt-question-heading"><strong class="cbt-question-number">${n}</strong><span>${text}</span></div><div class="cbt-answer-row">${slot(n)}</div></div>`;
  const intro=(range,title,instruction)=>`<header class="cbt-section-intro"><span class="cbt-kicker">${range}</span>${title?`<h3>${title}</h3>`:''}<p>${instruction}</p></header>`;
  const group=(range,instruction)=>intro('QUESTIONS '+range,'',instruction);
  const row=(label,body)=>`<tr><th scope="row">${label}</th><td>${body}</td></tr>`;
  const instructions='Complete the notes below. Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.';
  const listening= intro('PART 1 · QUESTIONS 1–10','PRESTON PARK RUN','Complete the notes below.')+
    group('1–6',instructions)+`<div class="cbt-table-wrap"><table class="cbt-data-table"><thead><tr><th colspan="2">Details of run</th></tr></thead><tbody>
    ${row('Example','Day of Park Run: <em>Saturday</em>.')}
    ${row('Start of run','in front of the '+numbered(1))}${row('Time of start',numbered(2))}
    ${row('Length of run',numbered(3))}${row('At end of run','volunteer scans '+numbered(4))}
    ${row('Best way to register','on the '+numbered(5))}${row('Cost of run','£ '+numbered(6))}
    </tbody></table></div>`+
    group('7–10',instructions)+`<div class="cbt-table-wrap"><table class="cbt-data-table"><thead><tr><th colspan="2">Volunteering</th></tr></thead><tbody>
    ${row('Contact name','Pete '+numbered(7))}${row('Phone number',numbered(8))}
    ${row('Activities','<p>setting up course</p><p>'+numbered(9)+' the runners</p><p>'+numbered(10)+' for the weekly report</p>')}
    </tbody></table></div>`;
  const events=[
    ['1992','the boat was discovered during the construction of a',''],
    ['2002','an international','was held to gather information'],
    ['2004','','for the reconstruction were produced'],
    ['2007','the','of BOAT 1550 BC took place'],
    ['2012','the Bronze Age','featured the boat and other objects']
  ];
  const truth=['Archaeologists realised that the boat had been damaged on purpose.',
    'Initially, only the technological aspects of the boat were examined.',
    'Archaeologists went back to the site to try and find the missing northern end of the boat.',
    'Evidence found in 2004 suggested that the Bronze Age Boat had been used for trade.'];
  const reading=group('1–5','Complete the flow-chart below. Choose <strong>ONE WORD ONLY</strong> from the text for each answer.')+
    '<h3>Key events</h3><div class="mini-flow">'+events.map(([year,before,after],i)=>
      `<div class="mini-flow-event"><strong>${year}</strong> — ${before} ${numbered(i+1)} ${after}</div>${i<4?'<div class="mini-flow-arrow" aria-hidden="true">↓</div>':''}`).join('')+'</div>'+
    group('6–9','Do the following statements agree with the information given in the text?')+
    '<div class="cbt-option-bank k56-truth-instructions"><p><strong>TRUE</strong><span>if the statement agrees with the information</span></p><p><strong>FALSE</strong><span>if the statement contradicts the information</span></p><p><strong>NOT GIVEN</strong><span>if there is no information on this</span></p></div>'+
    truth.map((t,i)=>`<div class="cbt-question-card" data-question-number="${i+6}" data-control="radio"><div class="cbt-question-heading"><strong class="cbt-question-number">${i+6}</strong><span>${t}</span></div><div class="cbt-choice-list">${['TRUE','FALSE','NOT GIVEN'].map(v=>`<label class="cbt-choice is-text-choice" data-choice-value="${v}"><span>${v}</span></label>`).join('')}</div>${slot(i+6)}</div>`).join('')+
    group('10–13','Answer the questions below. Choose <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> from the text for each answer.')+
    ['How far under the ground was the boat found?','What natural material had been secured to the boat to prevent water entering?',
    'What aspect of the boat was the focus of the 2012 reconstruction?','Which two factors influenced the decision not to make a full-scale reconstruction of the boat?'].map((t,i)=>question(i+10,t)).join('');
  const p=window.K56_MINI_PASSAGES[0];
  window.K56_TERM_TEST_CONTENT=Object.freeze({
    variant:'semantic-html',baseTestSlug:'mini-test-k56',
    audio:{src:'',label:'Mini Test · Preston Park Run',durationLabel:'Part 1'},
    listening:{instructions:['Bài nghe gồm 1 phần và 10 câu.','Hoàn thành kiểm tra âm thanh trước khi bắt đầu.'],sections:[{label:'Part 1',range:'Questions 1–10',html:listening}]},
    reading:{instructions:['Bạn có 20 phút để hoàn thành 13 câu.','Passage và câu hỏi có khung cuộn riêng.'],sections:[{
      label:'Passage 1',title:p.title,range:'Questions 1–13',
      passageHtml:`<article class="cbt-passage"><p><em>${p.subtitle}</em></p>${p.paragraphs.map(t=>'<p>'+t+'</p>').join('')}</article>`,questionsHtml:reading}]},
    writing:{totalMinutes:15,planningMinutes:3,tasks:[{id:'task2',label:'Đoạn văn',recommendedMinutes:15,minimumWords:100,initialSplit:50,
      prompt:'What are the advantages of wearing uniforms at school?',
      followUp:'Write a paragraph to answer this question.'}]}
  });
}());
