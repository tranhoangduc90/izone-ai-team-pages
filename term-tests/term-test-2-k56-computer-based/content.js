(function () {
  'use strict';
  const slot = n => `<span class="cbt-inline-answer" data-answer-slot="${n}"></span>`;
  const numbered = n => `<span class="cbt-answer-control" data-question-number="${n}"><strong class="cbt-blank-number">${n}</strong>${slot(n)}</span>`;
  const question = (n, text) => `<div class="cbt-question-card" data-question-number="${n}"><div class="cbt-question-heading"><strong class="cbt-question-number">${n}</strong><span>${text}</span></div><div class="cbt-answer-row">${slot(n)}</div></div>`;
  const sentence = (n, before, after='') => `<p class="k56-note-line${n===3?' is-subheading':''}">${n===3?'':'<span aria-hidden="true">• </span>'}${before} ${numbered(n)} ${after}</p>`;
  const diagramAnswers = numbers => `<div class="k56-diagram-answers" aria-label="Điền đáp án theo số trên hình">${numbers.map(n=>numbered(n)).join('')}</div>`;
  const choices = (n, stem, values, badge=true) => `<div class="cbt-question-card" data-question-number="${n}" data-control="radio"><div class="cbt-question-heading"><strong class="cbt-question-number">${n}</strong><span>${stem}</span></div><div class="cbt-choice-list">${values.map(([v,t])=>`<label class="cbt-choice${badge?'':' is-text-choice'}" data-choice-value="${v}">${badge?`<strong class="cbt-choice-letter">${v}</strong>`:''}<span>${t}</span></label>`).join('')}</div>${slot(n)}</div>`;
  const intro = (range, title, instruction) => `<header class="cbt-section-intro"><span class="cbt-kicker">${range}</span>${title?`<h3>${title}</h3>`:''}<p>${instruction}</p></header>`;
  const group = (range,instruction) => intro(`QUESTIONS ${range}`,'',instruction);
  const bank = items => `<div class="cbt-option-bank">${items.map(([v,t])=>`<div class="cbt-transport-option"><strong>${v}</strong><span>${t}</span></div>`).join('')}</div>`;
  const figure = (src,alt) => `<figure class="k56-original-figure"><img src="assets/figures/${src}" alt="${alt}"></figure>`;
  const list = items => `<ul>${items.map(t=>`<li>${t}</li>`).join('')}</ul>`;
  const oneWord = 'Complete the notes below. Write <strong>ONE WORD ONLY</strong> for each answer.';
  const listening = [
    intro('PART 1 · QUESTIONS 1–10','Hilary Lodge Retirement Home','Complete the notes below. Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.') +
    `<div class="k56-source-notes"><h3 class="k56-source-title">Hilary Lodge Retirement Home</h3><div class="k56-example"><em>Example</em><p>The name of the <u>manager</u> is Cathy</p></div><h4>Activities programme involving volunteers</h4>
    <p>Monday evenings: computer training</p>${sentence(1,'Training needed in how to produce')}
    <p>Tuesday afternoons: singing</p>${sentence(2,'The home has a','and someone to play it')}
    ${sentence(3,'Thursday mornings: growing')}${sentence(4,'The home doesn’t have many','for gardening')}
    <p><strong>Once a month:</strong> meeting for volunteers and staff</p><h4>Interview</h4>
    ${sentence(5,'Go in on',', any time')}${sentence(6,'Interview with assistant called')}${sentence(7,'Address of home: 73','Road')}
    <h4>‘Open house’ days</h4>${sentence(8,'Agreed to help on')}${sentence(9,'Will show visitors where to')}${sentence(10,'Possibility of talking to a','reporter')}</div>`,
    intro('PART 2 · QUESTIONS 11–20','Learning Resource Centre','Questions 11–15: Label the plan below. Write the correct letter, <strong>A–H</strong>, next to Questions 11–15.') +
    figure('resource-centre.png','Plan of Learning Resource Centre (Ground Floor), locations A–H')+
    ['Newspapers','Computers','Photocopier','Café','Sports books'].map((t,i)=>question(i+11,t)).join('')+
    group('16–20','Complete the table below. Write <strong>ONE WORD ONLY</strong> for each answer.')+
    `<h4>New staff responsibilities</h4><div class="cbt-table-wrap"><table class="cbt-data-table"><thead><tr><th>Name</th><th>New responsibility</th></tr></thead><tbody>
    <tr><td>Jenny Reed</td><td>Buying ${numbered(16)} for the Centre</td></tr>
    <tr><td>Phil Penshurst</td><td>Help with writing ${numbered(17)} for courses</td></tr>
    <tr><td>Tom Salisbury</td><td>Information on topics related to the ${numbered(18)}</td></tr>
    <tr><td>Saeed Aktar</td><td>Finding a ${numbered(19)}</td></tr>
    <tr><td>Shilpa Desai</td><td>Help with ${numbered(20)}</td></tr></tbody></table></div>`,
    intro('PART 3 · QUESTIONS 21–30','Making a training film','Questions 21–27: What helped Stewart with each of the following stages in making his training film for museum employees? Choose <strong>SEVEN</strong> answers from the box and write the correct letter, <strong>A–I</strong>, next to Questions 21–27.')+
    `<h4>What helped Stewart</h4><div class="cbt-matching-layout">${bank([
      ['A','advice from friends'],['B','information on a website'],['C','being allowed extra time'],['D','meeting a professional filmmaker'],['E','good weather conditions'],['F','getting a better computer'],['G','support of a manager'],['H','help from a family member'],['I','work on a previous assignment']
    ])}<div class="cbt-short-answer-list cbt-matching-questions"><h4>Stages in making training film for museum employees</h4>${['finding a location','deciding on equipment','writing the script','casting','filming','editing','designing the DVD cover'].map((t,i)=>question(i+21,t)).join('')}</div></div>`+
    group('28–30',oneWord)+`<div class="k56-source-notes"><h4>Stewart’s work placement: benefits to the Central Museum Association</h4>
    ${sentence(28,'his understanding of the Association’s')}<p>• the reduction in expense</p>
    ${sentence(29,'increased co-operation between')}${sentence(30,'continuous','which led to a better product')}<p>• ideas for distribution of the film</p></div>`,
    intro('PART 4 · QUESTIONS 31–40','New Caledonian crows and the use of tools',oneWord)+
    `<div class="k56-source-notes"><h3 class="k56-source-title">New Caledonian crows and the use of tools</h3><h4>Examples of animals using tools</h4><p>• some chimpanzees use stones to break nuts</p>
    ${sentence(31,'Betty (New Caledonian crow) made a','out of wire to move a bucket of food')}<p>• Barney (New Caledonian crow) used sticks to find food</p>
    <h4>New Zealand and Oxford experiment</h4>${sentence(32,'three stages: crows needed to move a','in order to reach a short stick; then use the short stick to reach a long stick; then use the long stick to reach food')}
    <h4>Oxford research</h4>${sentence(33,'crows used sticks to investigate whether there was any','from an object')}<p>• research was inspired by seeing crows using tools on a piece of cloth to investigate a spider design</p>
    ${sentence(34,'Barney used a stick to investigate a snake made of')}${sentence(35,'Pierre used a stick to investigate a')}<p>• Corbeau used a stick to investigate a metal toad</p><p>• the crows only used sticks for the first contact</p>
    <h4>Conclusions of above research</h4><p>• ability to plan provides interesting evidence of the birds’ cognition</p>${sentence(36,'unclear whether this is evidence of the birds’')}
    <h4>Exeter and Oxford research in New Caledonia</h4>${sentence(37,'scientists have attached very small cameras to birds’')}${sentence(38,'food in the form of beetle larvae provides plenty of','for the birds')}${sentence(39,'larvae’s specific','composition can be identified in birds that feed on them')}${sentence(40,'scientists will analyse what the birds include in their')}</div>`
  ];
  const roman = ['i','ii','iii','iv','v','vi','vii','viii','ix'];
  const headings = (start, end, texts) => group(`${start}–${end}`,`Reading Passage ${start===1?'1':'3'} has six paragraphs, <strong>A–F</strong>. Choose the correct heading for each paragraph from the list of headings below.`)+`<h4>List of Headings</h4>`+bank(texts.map((t,i)=>[roman[i],t]))+Array.from({length:6},(_,i)=>question(start+i,`Paragraph ${String.fromCharCode(65+i)}`)).join('');
  const reading1 = headings(1,6,[
    'The appearance and location of different seaweeds','The nutritional value of seaweeds','How seaweeds reproduce and grow','How to make agar from seaweeds','The under-use of native seaweeds','Seaweed species at risk of extinction','Recipes for how to cook seaweeds','The range of seaweed products','Why seaweeds don’t sink or dry out'
  ]) + group('7–10','Complete the flow-chart below. Choose <strong>NO MORE THAN THREE WORDS</strong> from the passage for each answer.')+
  figure('seaweed-flowchart-original.png','Gigartina seaweed: flow-chart with blanks 7, 8, 9 and 10')+diagramAnswers([7,8,9,10])+
  group('11–13','Look at the following statements and list of seaweeds below. Match each statement with the correct seaweed, <strong>A, B or C</strong>.')+bank([['A','brown seaweed'],['B','green seaweed'],['C','red seaweed']])+
  ['can survive the heat and dryness at the high-water mark','grow far out in the open sea','share their site with karengo seaweed'].map((t,i)=>question(i+11,t)).join('');
  const reading2 = group('14–17','Label the diagrams below. Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.')+
  figure('crow-tools.png','Three tools made by crows: diagrams with blank labels 14–17')+diagramAnswers([14,15,16,17])+
  group('18–23','Do the following statements agree with the information given in Reading Passage 2?')+
  `<div class="k56-truth-instructions"><p><strong>TRUE</strong><span>if the statement agrees with the information</span></p><p><strong>FALSE</strong><span>if the statement contradicts the information</span></p><p><strong>NOT GIVEN</strong><span>if there is no information on this</span></p></div>`+
  [
    'There appears to be a fixed pattern for the pandanus probe’s construction.',
    'There is plenty of evidence to indicate how the crows manufacture the pandanus probe.',
    'Crows seem to practise a number of times before making a usable pandanus probe.',
    'The researchers suspect the crows have a mental image of the pandanus probe before they create it.',
    'Research into how the pandanus probe is made has helped to explain the toolmaking skills of many other bird species.',
    'The researchers believe the ability to make the pandanus probe is passed down to the crows in their genes.'
  ].map((t,i)=>choices(i+18,t,['TRUE','FALSE','NOT GIVEN'].map(v=>[v,v]),false)).join('')+
  group('24–26','Choose <strong>THREE</strong> letters, <strong>A–G</strong>.')+
  `<div class="cbt-question-card" data-control="multi" data-question-numbers="24,25,26"><div class="cbt-question-heading"><strong class="cbt-question-number">24–26</strong><span>According to the information in the passage, which THREE of the following features are probably common to both New Caledonian crows and human beings?</span></div><div class="cbt-choice-list">${[
    'keeping the same mate for life','having few natural predators','having a bias to the right when working','being able to process sequential tasks','living in extended family groups','eating a variety of foodstuffs','being able to adapt to diverse habitats'
  ].map((t,i)=>`<label class="cbt-choice" data-choice-value="${String.fromCharCode(65+i)}"><strong class="cbt-choice-letter">${String.fromCharCode(65+i)}</strong><span>${t}</span></label>`).join('')}</div>${slot(24)}${slot(25)}${slot(26)}</div>`;
  const reading3 = headings(27,32,[
    'The difficulties of talking about smells','The role of smell in personal relationships','Future studies into smell','The relationship between the brain and the nose','The interpretation of smells as a factor in defining groups','Why our sense of smell is not appreciated','Smell is our superior sense','The relationship between smell and feelings'
  ])+group('33–36','Choose the correct letter, <strong>A, B, C or D</strong>.')+
  [
    ['According to the introduction, we become aware of the importance of smell when',['we discover a new smell.','we experience a powerful smell.','our ability to smell is damaged.','we are surrounded by odours.']],
    ['The experiment described in paragraph B',['shows how we make use of smell without realising it.','demonstrates that family members have a similar smell.','proves that a sense of smell is learnt.','compares the sense of smell in males and females.']],
    ['What is the writer doing in paragraph C?',['supporting other research','making a proposal','rejecting a common belief','describing limitations']],
    ['What does the writer suggest about the study of smell in the atmosphere in paragraph E?',['The measurement of smell is becoming more accurate.','Researchers believe smell is a purely physical reaction.','Most smells are inoffensive.','Smell is yet to be defined.']]
  ].map(([stem,options],i)=>choices(i+33,stem,options.map((t,j)=>[String.fromCharCode(65+j),t]))).join('')+
  group('37–40','Complete the sentences below. Choose <strong>ONE WORD ONLY</strong> from the passage for each answer.')+
  [
    'Tests have shown that odours can help people recognise the … belonging to their husbands and wives.',
    'Certain linguistic groups may have difficulty describing smell because they lack the appropriate … .',
    'The sense of smell may involve response to … which do not smell, in addition to obvious odours.',
    'Odours regarded as unpleasant in certain … are not regarded as unpleasant in others.'
  ].map((t,i)=>question(i+37,t)).join('');
  const passageHtml = (p,i) => `<article class="cbt-passage">${p.subtitle?`<p><em>${p.subtitle}</em></p>`:''}${p.paragraphs.map((t,j)=>`<p>${p.unlettered?'':`<strong>${String.fromCharCode(65+j)}</strong> &nbsp;`}${t}</p>`).join('')}</article>`;
  window.K56_TERM_TEST_CONTENT = Object.freeze({
    variant:'semantic-html',baseTestSlug:'term-test-2-k56',
    audio:{src:'',label:'Term Test 2 · Khóa 56 · Listening',durationLabel:'4 phần nghe liên tục'},
    listening:{instructions:['Bài nghe gồm 4 phần và 40 câu. Hoàn thành kiểm tra âm thanh trước khi bắt đầu.','Không tải lại hoặc đóng tab khi audio đang phát.'],sections:listening.map((html,i)=>({label:`Part ${i+1}`,range:`Questions ${i*10+1}–${i*10+10}`,html}))},
    reading:{instructions:['Bạn có 60 phút để hoàn thành 3 passages và 40 câu.','Passage và câu hỏi có khung cuộn riêng.','Còn 10 phút đồng hồ chuyển đỏ; hết giờ hệ thống tự nộp.'],sections:window.K56_TEST2_PASSAGES.map((p,i)=>({label:`Passage ${i+1}`,title:p.title,range:['Questions 1–13','Questions 14–26','Questions 27–40'][i],passageHtml:passageHtml(p,i),questionsHtml:[reading1,reading2,reading3][i]}))},
    writing:{totalMinutes:30,planningMinutes:10,tasks:[{id:'task1',label:'Task 1',recommendedMinutes:30,minimumWords:150,initialSplit:50,
      prompt:'The graph below shows the amounts of waste produced by three companies over a period of 15 years.',
      followUp:'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
      image:{src:'assets/figures/writing-waste.png',alt:'Waste produced by companies A, B and C between 2000 and 2015, in tonnes.'}}]}
  });
}());
