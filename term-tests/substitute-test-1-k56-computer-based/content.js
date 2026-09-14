(function () {
  'use strict';

  const slot = number => `<span class="cbt-inline-answer" data-answer-slot="${number}"></span>`;
  const numberedSlot = number => `
    <span class="cbt-answer-control" data-question-number="${number}">
      <strong class="cbt-blank-number">${number}</strong>
      ${slot(number)}
    </span>`;
  const textQuestion = (number, text) => `
    <div class="cbt-question-card" data-question-number="${number}">
      <div class="cbt-question-heading"><strong class="cbt-question-number">${number}</strong><span>${text}</span></div>
      <div class="cbt-answer-row">${slot(number)}</div>
    </div>`;
  const sentenceQuestion = (number, before, after = '') => `
    <div class="cbt-question-card cbt-sentence-card" data-question-number="${number}">
      <div class="cbt-question-heading">
        <strong class="cbt-question-number">${number}</strong>
        <p class="cbt-sentence-question"><span>${before}</span>${slot(number)}<span>${after}</span></p>
      </div>
    </div>`;
  const choiceQuestion = (number, stem, choices, showChoiceBadge = false) => `
    <div class="cbt-question-card" data-question-number="${number}" data-control="radio">
      <div class="cbt-question-heading"><strong class="cbt-question-number">${number}</strong><span>${stem}</span></div>
      <div class="cbt-choice-list">
        ${choices.map(item => {
          const [value, label] = Array.isArray(item) ? item : [item, item];
          return `<label class="cbt-choice${showChoiceBadge ? '' : ' is-text-choice'}" data-choice-value="${value}">${showChoiceBadge ? `<strong class="cbt-choice-letter">${value}</strong>` : ''}<span>${label}</span></label>`;
        }).join('')}
      </div>
      ${slot(number)}
    </div>`;

  const listeningPart1 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">SECTION 1 · QUESTIONS 1–10</span>
      <h3>Cianfanelli Property Loss/Damage Report Form</h3>
      <p>Questions 1–3: Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-form-card">
      <div class="cbt-form-row is-example"><span>Name</span><span>Cirilla Fionna</span></div>
      <div class="cbt-form-row"><span>Phone number</span>${numberedSlot(1)}</div>
      <div class="cbt-form-row"><span>Address</span><span>${numberedSlot(2)}, Toussaint</span></div>
      <div class="cbt-form-row"><span>Shipping company</span><span>EA Merchant Marine</span></div>
      <div class="cbt-form-row"><span>Date of arrival</span>${numberedSlot(3)}</div>
      <div class="cbt-form-row"><span>Shipment code</span><span>GTX-1060</span></div>
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 4–10</span>
      <p>Complete the table. Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-table-wrap">
      <table class="cbt-data-table">
        <thead><tr><th>Items</th><th>Problems</th><th>Estimated cost</th></tr></thead>
        <tbody>
          <tr><td>${numberedSlot(4)}</td><td>a lot of ${numberedSlot(5)} are missing</td><td>$40</td></tr>
          <tr><td rowspan="2">Violin</td><td>a huge crack on the body</td><td rowspan="2">no less than ${numberedSlot(7)}</td></tr>
          <tr><td>the ${numberedSlot(6)} is detached</td></tr>
          <tr><td>${numberedSlot(8)}</td><td>${numberedSlot(9)}</td><td>$30</td></tr>
          <tr><td>Electric pressure cooker</td><td>the ${numberedSlot(10)} needs replacing</td><td>unknown</td></tr>
        </tbody>
      </table>
    </div>`;

  const listeningPart2 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">SECTION 2 · QUESTIONS 11–20</span>
      <h3>Kinney Hotel</h3>
      <p>Questions 11–15: Write <strong>NO MORE THAN TWO WORDS</strong> for each answer.</p>
    </header>
    <div class="cbt-note-group">
      ${sentenceQuestion(11, 'Located in the town centre, near the', '.')}
      ${sentenceQuestion(12, 'Rated 4-star by a', '.')}
      ${sentenceQuestion(13, 'The most luxurious and expensive room in the hotel is the', '.')}
      ${sentenceQuestion(14, 'Has a restaurant specialising in Norwegian', 'on ground floor.')}
      ${sentenceQuestion(15, 'Has a special', 'on the 15th floor.')}
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 16–20</span>
      <p>Label the plan below. Write the correct letter <strong>A–G</strong>.</p>
    </header>
    <div class="k56-side-layout k56-map-layout">
      <figure class="cbt-park-map" aria-label="Ground floor of Kinney Hotel">
        <img src="assets/figures/kinney-hotel-plan.png" width="1900" height="1040" alt="Ground floor of Kinney Hotel with locations A to G, the elevator, reception and entrance.">
      </figure>
      <div class="cbt-short-answer-list">
        ${textQuestion(16, 'Art gallery')}
        ${textQuestion(17, 'Fountain')}
        ${textQuestion(18, 'Restaurant')}
        ${textQuestion(19, 'Bakery')}
        ${textQuestion(20, 'Bar')}
      </div>
    </div>`;

  const listeningPart3 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">SECTION 3 · QUESTIONS 21–30</span>
      <h3>Student Information</h3>
      <p>Questions 21–24: Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-form-card">
      <div class="cbt-form-row is-example"><span>Name</span><span>Denise Gough</span></div>
      <div class="cbt-form-row"><span>Faculty</span>${numberedSlot(21)}</div>
      <div class="cbt-form-row"><span>Phone number</span><span>8918220</span></div>
      <div class="cbt-form-row"><span>Address</span><span>${numberedSlot(22)}, Ennis</span></div>
      <div class="cbt-form-row"><span>Previous jobs</span><span>private tutor<br>${numberedSlot(23)}</span></div>
      <div class="cbt-form-row"><span>Skills</span><span>fluent in Polish and ${numberedSlot(24)}<br>can play the violin</span></div>
      <div class="cbt-form-row"><span>Special interests</span><span>sport; videogames</span></div>
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 25–30</span>
      <p>Complete the table. Write <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-table-wrap">
      <table class="cbt-data-table">
        <thead><tr><th>Job vacancy</th><th>Important details</th><th>Schedule</th><th>Main problems</th></tr></thead>
        <tbody>
          <tr><td>${numberedSlot(25)}</td><td>check if customers are over the drinking age</td><td>8 pm–2 am<br>${numberedSlot(26)}</td><td>too late at night</td></tr>
          <tr><td>violin teacher</td><td>take care of ${numberedSlot(27)}</td><td>6 pm–8 pm every weekend</td><td>student hates ${numberedSlot(28)}</td></tr>
          <tr><td>${numberedSlot(29)} for a game developer</td><td>having a ${numberedSlot(30)} is a major bonus</td><td>flexible (except for Monday)</td><td>too far from home</td></tr>
        </tbody>
      </table>
    </div>`;

  const listeningPart4 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">SECTION 4 · QUESTIONS 31–40</span>
      <h3>Winchester Haunted House</h3>
      <p>Questions 31–34: Write <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-note-group">
      ${sentenceQuestion(31, 'The attraction was inspired by', '.')}
      ${sentenceQuestion(32, 'It is located in the', '.')}
      ${sentenceQuestion(33, '', 'are not allowed to enter.')}
      ${sentenceQuestion(34, 'It is closed on', '.')}
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 35–40</span>
      <p>Which feature is found in each room? Choose the correct letter <strong>A–H</strong>.</p>
    </header>
    <div class="k56-side-layout k56-answers-left">
      <div class="cbt-option-bank">
        <p><strong>A</strong> a religious tradition of resurrecting the deceased</p>
        <p><strong>B</strong> a horror story told by people in China</p>
        <p><strong>C</strong> an investigator pursuing a notorious criminal</p>
        <p><strong>D</strong> an abandoned hospital in England</p>
        <p><strong>E</strong> a true origin mistaken by many people</p>
        <p><strong>F</strong> the house of a young girl brutally killed by a gun</p>
        <p><strong>G</strong> special sound effects</p>
        <p><strong>H</strong> a murderer confronting the spirits of his victims</p>
      </div>
      <div class="cbt-short-answer-list">
        ${textQuestion(35, 'Asylum')}
        ${textQuestion(36, 'Tomb')}
        ${textQuestion(37, 'Operation room')}
        ${textQuestion(38, 'Altar room')}
        ${textQuestion(39, 'Warehouse')}
        ${textQuestion(40, 'Hall')}
      </div>
    </div>`;

  const dramaPassage = `
    <p class="cbt-passage-deck"><em>Drama student Imogen Clare-Wood describes a collaborative theatre project she took part in.</em></p>
    <p>This project was born from discussions I had with other drama students about the kind of theatre productions we’d like to create. Although we had previously been involved in various university productions where we took on specific roles, such as costume designer, producer, director and so on, we now wanted to take a collaborative approach that was new to all of us. We wanted a project in which every voice would carry equal weight and everyone would be able to contribute to every aspect of the show. We decided that the way to achieve this feeling of collaboration would be to concentrate on the process by which the work emerged during auditions and rehearsals. We chose a play that we felt allowed varied interpretations – Harold Pinter’s <em>The Lover</em>, a modern one-act play with just two characters. We decided we would use six actors cast as three different couples, and each pair would have a turn to perform on one of the three nights that the play was to be staged.</p>
    <p>The next step was to hold auditions in order to find six actors who felt the same way about the project as we did. We were anxious not to create an ‘us and them’ feeling to the auditions, since collective ownership of the project was crucial to our ideas. So we ran the first round of auditions as a series of workshops, which we kept very informal and relaxed. Then we recalled fifteen actors for the second round of auditions. At this stage we wanted the reactions and ideas to flow and be explored by the group in the form of a discussion. We were looking for actors who could encourage other people’s ideas but who were also eager to input their own thoughts. Possibly the hardest part of the whole process was sitting down afterwards and deciding on the final six actors who would take part in the project.</p>
    <p>Our initial rehearsals were dedicated to creating a strong group dynamic and to exploring some of the themes of the play without explicit reference to the script. One of the strongest tools we used for this was ‘freewriting’ – an exercise in which one person would read out a list of unconnected words and the rest of the group would clear their minds and simply write something in response to those words. We found it helped us to gain insight into the different ways our minds work. It also meant that we got to know each other very well, very quickly!</p>
    <p>It was only during the next phase of rehearsals that we finally began to work with the script. We had not yet decided on the pairings for the six actors at this point, and we had the non-actors on the team reading in addition to the people who would be doing the final performances. The whole team finally decided on the pairings of the actors by a vote, and miraculously it was a unanimous decision. The casting of the roles worked well and felt more natural than it had in any other show I’ve worked on. I think the dynamic that we developed over the early rehearsals was crucial in giving us three such strong onstage relationships.</p>
    <p>Other decisions were made in much the same way. The publicity was the responsibility of one member of the team, but she asked everyone what they thought would be effective. She then made several different versions, and from these we chose the design we liked the most. The stage set was left more to the individual pairs of actors, but since a large part of the later rehearsals was observing and feeding back on the individual performances being created by each pair, everyone was able to help with set design. We initially planned that each pair would use the same stage set. However, due to the different ways they interpreted the script, it became important for the set to be adapted for each couple.</p>
    <p>In the final performances, it was surprising that despite the collaborative nature of the project, a range of very different interpretations emerged. This is, of course, partly due to the tragicomic nature of Pinter’s text, which allowed the pairs of actors to exploit these two disparate elements, tragedy and comedy, to different degrees.</p>
    <p>The question and answer session held after the show was perhaps the most rewarding part of the project. The questions that the audience asked were interesting and insightful, and certainly made everyone in the team think about what we’d been doing, what we’d wanted to achieve and whether we’d achieved it. We were asked, among other things, about how successful our collaborative ethic had been, how we’d ended up with three such different shows, how we’d overcome the initial ‘production team versus cast’ divide, and how we would continue in the future.</p>`;

  const dramaQuestions = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">QUESTIONS 1–6</span>
      <p>Complete the flow-chart. Choose <strong>ONE WORD ONLY</strong> from the passage for each answer.</p>
    </header>
    <div class="cbt-form-card cbt-flow-chart">
      <h4>Origin of project</h4>
      <p>Started with the wish for a collaborative project focusing on the ${numberedSlot(1)} of producing a play.</p>
      <h4>Auditions</h4>
      <p>First round: organised as several workshops; fifteen actors were then selected.</p>
      <p>Second round: organised as a ${numberedSlot(2)}; the final six actors were then selected.</p>
      <h4>Preparation</h4>
      <p>In early rehearsals, ${numberedSlot(3)} was found to be an effective technique.</p>
      <p>The ${numberedSlot(4)} was only used in later rehearsals.</p>
      <p>Everyone had a ${numberedSlot(5)} to decide which actor would play each part.</p>
      <p>Everyone was shown different designs for the publicity and the best one was chosen.</p>
      <h4>Performances</h4>
      <p>The variety of ${numberedSlot(6)} was surprising.</p>
      <h4>After-show question and answer session</h4>
      <p>This resulted in some interesting comments.</p>
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 7–13</span>
      <p>Do the statements agree with Reading Passage 1? Choose <strong>TRUE</strong>, <strong>FALSE</strong> or <strong>NOT GIVEN</strong>.</p>
    </header>
    ${choiceQuestion(7, 'The writer had been involved in other collaborative theatre productions at university.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(8, 'Each actor chosen for the project would play one role for three nights.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(9, 'The early rehearsals took place at the university theatre.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(10, 'The writer felt satisfied that all the actors were paired with the right partner.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(11, 'Some team members discovered an unexpected talent for set design.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(12, 'The original intention was to use a different stage set for each performance.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(13, 'The question and answer session encouraged the team to think about their aims.', ['TRUE', 'FALSE', 'NOT GIVEN'])}`;

  const saharaPassage = `
    <section class="cbt-lettered-paragraph"><span>A</span><div><p>The Sahara is the largest hot desert in the world, and the third largest desert behind Antarctica and the Arctic, which are both cold deserts. The Sahara is one of the harshest environments on earth, covering 3.6 million square miles (9.4 million square kilometers), nearly a third of the African continent, about the size of the United States (including Alaska and Hawaii). The Sahara is bordered by the Atlantic Ocean on the west, the Red Sea on the east, the Mediterranean Sea on the north and the Sahel Savannah on the south. The enormous desert spans 11 countries: Algeria, Chad, Egypt, Libya, Mali, Mauritania, Morocco, Niger, Western Sahara, Sudan and Tunisia.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>B</span><div><p>The Sahara desert has a variety of terrains, but is most famous for the sand dune fields that are often depicted in movies. The dunes can reach almost 600 feet (183 meters) high but they cover only about 15 percent of the entire desert. Other topographical features include mountains, plateaus, sand- and gravel-covered plains, salt flats, basins and depressions. Mount Koussi, an extinct volcano in Chad, is the highest point in the Sahara at 11,204 feet (3,415 m), and the Qattara Depression in Egypt is the Saraha's deepest point, at 436 feet (133 m) below sea level.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>C</span><div><p>Water is scarce across the entire region, yet the Sahara contains two permanent rivers (the Nile and the Niger), at least 20 seasonal lakes and huge aquifers, which are the primary sources of water in the more than 90 major desert oases. Water management authorities once feared the aquifers in the Sahara would soon dry up due to overuse, but a study published in the journal <em>Geophysical Research Letters</em> in 2013, discovered that the “fossil” (nonrenewable) aquifers were still being fed via rain and runoff.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>D</span><div><p>Despite the harsh, arid conditions of the desert, several plants and animals call the region home. There are approximately 500 species of plants, 70 known mammalian species, 90 avian species and 100 reptilian species that live in the Sahara, plus several species of spiders, scorpions and other small arthropods, according to World Wildlife Fund. Camels are one of the most iconic animals of the Sahara. The large mammals are native to North America and eventually made their way across the Bering Isthmus between 3 and 5 million years ago, according to a study in the <em>Research Journal of Agriculture and Environmental Management</em> in 2015. Camels were domesticated about 3,000 years ago on the Southeast Arabian Peninsula, to be used for various purposes, one of which is transportation in the desert, according to the University of Veterinary Medicine, Vienna. Plant species in the Sahara have adapted to the arid conditions, with roots that reach deep underground to find buried water sources and leaves that are shaped into spines that minimize moisture loss. The most arid parts of the desert are completely void of plant life, but oasis areas, such as the Nile Valley, support a large variety of plants.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>E</span><div><p>For the past 2,000 years or so, the climate of the Sahara has been fairly stable. The northeastern winds dry out the air over the desert and drive hot winds toward the equator. These winds can reach exceptional speeds and cause severe dust storms that can drop local visibility to zero. Dust from the Sahara travels on trade winds all the way to the opposite side of the globe. Precipitation in the Sahara ranges from zero to about 3 inches of rain per year, with some locations not seeing rain for several years at a time. Occasionally, snow falls at higher elevations. Daytime summer temperatures are often over 100 degrees Fahrenheit (38 degrees Celsius) and can drop to near-freezing temperatures at nighttime.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>F</span><div><p>The Sahara alternates from being a dry, inhospitable desert to a lush, green oasis about every 20,000 years, according to a study published in the journal <em>Science Advances</em> in 2019. The study's authors examined marine sediments containing dust deposits from the Sahara from the past 240,000 years. The team found that the cycle between a dry and a green Sahara corresponded to the slight changes in the tilt of Earth's axis, which also drives monsoon activity. When the Earth's axis tilted the Northern Hemisphere just a single degree closer to the sun (about 24.5 degrees instead of today's 23.5 degrees), it received more sunlight, which increased the monsoon rains and therefore, supported a lush green landscape in the Sahara.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>G</span><div><p>The area of the Sahara desert has grown nearly 10 percent since 1920, according to a 2018 study published in the <em>Journal of Climate</em>. While all deserts, including the Sahara, increase in area during the dry season and decrease during the wet season, human-caused climate change in conjunction with natural climate cycles, are causing the Sahara desert to grow more and shrink less. The study's authors estimated that approximately a third of the desert's expansion was due to human-made climate change.</p></div></section>`;

  const saharaQuestions = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">QUESTIONS 14–20</span>
      <p>Reading Passage 2 has seven paragraphs, A–G. Choose the correct heading from the list below. Write the correct number, <strong>i–x</strong>.</p>
    </header>
    <div class="k56-side-layout k56-answers-left">
      <div class="cbt-option-bank cbt-heading-bank">
        <p><strong>i</strong> Impacts of the increase in deserts’ size</p>
        <p><strong>ii</strong> Extreme weather affecting local residents many times a year</p>
        <p><strong>iii</strong> How to deal with the lack of water</p>
        <p><strong>iv</strong> How human beings interfere with a natural process</p>
        <p><strong>v</strong> No worries about the insufficiency of water</p>
        <p><strong>vi</strong> Fauna and flora</p>
        <p><strong>vii</strong> Size and geographical position</p>
        <p><strong>viii</strong> A variety of weather patterns in the Sahara</p>
        <p><strong>ix</strong> Effects of changes in the position of the planet</p>
        <p><strong>x</strong> A range of geographical features in the Sahara</p>
      </div>
      <div class="cbt-short-answer-list">
        ${textQuestion(14, 'Paragraph A')}
        ${textQuestion(15, 'Paragraph B')}
        ${textQuestion(16, 'Paragraph C')}
        ${textQuestion(17, 'Paragraph D')}
        ${textQuestion(18, 'Paragraph E')}
        ${textQuestion(19, 'Paragraph F')}
        ${textQuestion(20, 'Paragraph G')}
      </div>
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 21–26</span>
      <p>Do the statements agree with Reading Passage 2? Choose <strong>TRUE</strong>, <strong>FALSE</strong> or <strong>NOT GIVEN</strong>.</p>
    </header>
    ${choiceQuestion(21, 'The Sahara is larger than any other hot deserts across the globe.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(22, 'Despite the scarcity of water in the Sahara, there are rivers and lakes that are filled with water all year round.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(23, 'Spiders, scorpions and some arthropods in the Sahara are smaller than those in other places.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(24, 'Ancient Arabian people are believed to have recently used camels for transportation.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(25, 'Dust storms in the Sahara are so severe that people nearby can hardly see anything.', ['TRUE', 'FALSE', 'NOT GIVEN'])}
    ${choiceQuestion(26, 'The earth is unlikely to tilt closer to the Sun in many thousand years to come.', ['TRUE', 'FALSE', 'NOT GIVEN'])}`;

  window.K56_SUBSTITUTE_TEST_CONTENT = Object.freeze({
    variant: 'semantic-html',
    baseTestSlug: 'substitute-test-1-k56',
    audio: {
      src: 'https://izone-substitute-test-1-k56.wingsenglish90.chatgpt.site/api/test/audio',
      label: 'Substitute Test 1 · Khóa 56 · Listening',
      durationLabel: '27 phút 58 giây'
    },
    listening: {
      instructions: [
        'Bài nghe gồm 4 phần và 40 câu. Hoàn thành bước kiểm tra âm thanh trước khi bắt đầu.',
        'Audio dài đúng 27 phút 58 giây; không có thời gian kiểm tra riêng sau khi audio kết thúc.',
        'Không tải lại hoặc đóng tab khi audio đang phát.'
      ],
      sections: [
        { label: 'Section 1', range: 'Questions 1–10', html: listeningPart1 },
        { label: 'Section 2', range: 'Questions 11–20', html: listeningPart2 },
        { label: 'Section 3', range: 'Questions 21–30', html: listeningPart3 },
        { label: 'Section 4', range: 'Questions 31–40', html: listeningPart4 }
      ]
    },
    reading: {
      instructions: [
        'Bạn có 40 phút để hoàn thành 2 passages và 26 câu.',
        'Passage và câu hỏi có khung cuộn riêng trên máy tính và xếp dọc trên thiết bị nhỏ.',
        'Còn 10 phút đồng hồ sẽ chuyển đỏ; hết giờ hệ thống tự nộp bài.'
      ],
      sections: [
        {
          label: 'Passage 1',
          title: 'Report on a university drama project',
          range: 'Questions 1–13',
          passageHtml: dramaPassage,
          questionsHtml: dramaQuestions
        },
        {
          label: 'Passage 2',
          title: 'THE SAHARA',
          range: 'Questions 14–26',
          passageHtml: saharaPassage,
          questionsHtml: saharaQuestions
        }
      ]
    },
    writing: {
      totalMinutes: 55,
      planningMinutes: 15,
      tasks: [
        {
          id: 'task2',
          label: 'Task 2',
          recommendedMinutes: 40,
          minimumWords: 250,
          initialSplit: 44,
          prompt: 'Many people think cheap air travel should be encouraged because it give ordinary people freedom to travel further. However, others think this leads to environmental problems, so air travel should be more expensive in order to discourage people from having it.',
          followUp: 'Discuss both views and give your own opinion.'
        }
      ]
    }
  });
}());
