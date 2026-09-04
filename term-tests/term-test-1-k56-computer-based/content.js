(function () {
  'use strict';

  const slot = number => `<span class="cbt-inline-answer" data-answer-slot="${number}"></span>`;
  const numberedSlot = (number, key = number) => `
    <span class="cbt-answer-control" data-question-number="${number}">
      <strong class="cbt-blank-number">${number}</strong>
      ${slot(key)}
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
  const choiceQuestion = (number, stem, choices, showChoiceBadge = true) => `
    <div class="cbt-question-card" data-question-number="${number}" data-control="radio">
      <div class="cbt-question-heading"><strong class="cbt-question-number">${number}</strong><span>${stem}</span></div>
      <div class="cbt-choice-list">
        ${choices.map(([value, label]) => `<label class="cbt-choice${showChoiceBadge ? '' : ' is-text-choice'}" data-choice-value="${value}">${showChoiceBadge ? `<strong class="cbt-choice-letter">${value}</strong>` : ''}<span>${label}</span></label>`).join('')}
      </div>
      ${slot(number)}
    </div>`;

  const listeningPart1 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">PART 1 · QUESTIONS 1–10</span>
      <h3>KT Furniture · Customer Order Form</h3>
      <p>Questions 1–5: Write <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-form-card">
      <h4>Customer details</h4>
      <div class="cbt-form-row is-example"><span>Caller’s name</span><span>Sue Brown</span></div>
      <div class="cbt-form-row"><span>Company name</span>${numberedSlot(1)}</div>
      <div class="cbt-form-row"><span>Address</span><span>${numberedSlot(2)} Trading Estate<br>210 New Hampton Road<br>South Down</span></div>
      <div class="cbt-form-row"><span>Contact number</span><span>${numberedSlot(3)} (mobile)</span></div>
      <div class="cbt-form-row"><span>Delivery option</span><span>1 ☐ &nbsp; 2 ☑ &nbsp; (no ${numberedSlot(4)})</span></div>
      <div class="cbt-form-row"><span>Method of payment</span><span>credit card &nbsp; Type: ${numberedSlot(5)}</span></div>
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 6–10</span>
      <p>Complete the table. Write <strong>NO MORE THAN TWO WORDS AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-table-wrap">
      <table class="cbt-data-table">
        <thead><tr><th>Item</th><th>Code</th><th>Colour</th><th>Quantity</th></tr></thead>
        <tbody>
          <tr><td>Office chairs</td><td>ASP 23</td><td>${numberedSlot(6)}</td><td>5</td></tr>
          <tr><td>${numberedSlot(7)}</td><td>${numberedSlot(8)}</td><td>-</td><td>2</td></tr>
          <tr><td>Leather sofa</td><td>DFD 44</td><td>${numberedSlot(9)}</td><td>1</td></tr>
          <tr><td>${numberedSlot(10)}</td><td>TX 22</td><td>silver</td><td>1</td></tr>
        </tbody>
      </table>
    </div>`;

  const listeningPart2 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">PART 2 · QUESTIONS 11–20</span>
      <h3>Marathon · Tips for spectators</h3>
      <p>Questions 11–17: Write <strong>NO MORE THAN TWO WORDS</strong> for each answer.</p>
    </header>
    <div class="cbt-note-group">
      ${sentenceQuestion(11, 'To enjoy the day, make sure you', 'it first.')}
      ${sentenceQuestion(12, 'Travel', 'within the city centre.')}
      ${sentenceQuestion(13, 'Wear', 'on the day.')}
      ${sentenceQuestion(14, 'Check the', 'the night before the marathon.')}
      ${sentenceQuestion(15, 'Let the', 'give drinks to runners.')}
      ${sentenceQuestion(16, 'Stay on one side of the road to avoid', '.')}
      ${sentenceQuestion(17, 'Don’t arrange to meet runners near the', '.')}
    </div>
    <header class="cbt-section-intro is-compact">
      <span class="cbt-kicker">QUESTIONS 18–20</span>
      <p>What does the speaker say about the following forms of transport? Choose A–E.</p>
    </header>
    <div class="cbt-matching-layout">
      <div class="cbt-option-bank">
        <div class="cbt-transport-option"><strong>A</strong><span>will take more passengers than usual</span></div>
        <div class="cbt-transport-option"><strong>B</strong><span>will suit people who want to see the start of the race</span></div>
        <div class="cbt-transport-option"><strong>C</strong><span>waiting times will be longer than usual</span></div>
        <div class="cbt-transport-option"><strong>D</strong><span>will have fewer staff than usual</span></div>
        <div class="cbt-transport-option"><strong>E</strong><span>some work schedules will change</span></div>
      </div>
      <div class="cbt-short-answer-list cbt-matching-questions">
        ${textQuestion(18, 'taxis')}
        ${textQuestion(19, 'trams')}
        ${textQuestion(20, 'buses')}
      </div>
    </div>`;

  const listeningPart3 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">PART 3 · QUESTIONS 21–30</span>
      <h3>Accommodation Form · Student Information</h3>
      <p>Write <strong>ONE WORD AND/OR A NUMBER</strong> for each answer.</p>
    </header>
    <div class="cbt-form-card cbt-accommodation-form">
      <div class="cbt-form-row is-example"><span>Type of accommodation</span><span>hall of residence</span></div>
      <div class="cbt-form-row"><span>Name</span><span>Anu ${numberedSlot(21)}</span></div>
      <div class="cbt-form-row"><span>Date of birth</span>${numberedSlot(22)}</div>
      <div class="cbt-form-row"><span>Country of origin</span><span>India</span></div>
      <div class="cbt-form-row"><span>Course of study</span>${numberedSlot(23)}</div>
      <div class="cbt-form-row"><span>Number of years planned in hall</span>${numberedSlot(24)}</div>
      <div class="cbt-form-row"><span>Preferred catering arrangement</span><span>half board</span></div>
      <div class="cbt-form-row"><span>Special dietary requirements</span><span>no ${numberedSlot(25)} (red)</span></div>
      <div class="cbt-form-row"><span>Preferred room type</span><span>a single ${numberedSlot(26)}</span></div>
      <div class="cbt-form-row"><span>Interests</span><span>the ${numberedSlot(27)}<br>badminton</span></div>
      <div class="cbt-form-row"><span>Priorities in choice of hall</span><span>to be with other students who are ${numberedSlot(28)}<br>to live outside the ${numberedSlot(29)}<br>to have a ${numberedSlot(30)} area for socialising</span></div>
      <div class="cbt-form-row"><span>Contact phone number</span><span>667549</span></div>
    </div>`;

  const listeningPart4 = `
    <header class="cbt-section-intro">
      <span class="cbt-kicker">PART 4 · QUESTIONS 31–40</span>
      <h3>Parks and open spaces</h3>
      <p>Questions 31–33: Write <strong>NO MORE THAN THREE WORDS</strong> for each answer.</p>
    </header>
    <div class="cbt-table-wrap">
      <table class="cbt-data-table">
        <thead><tr><th>Name of place</th><th>Of particular interest</th><th>Open</th></tr></thead>
        <tbody>
          <tr><td>Halland Common</td><td>source of River Ouse</td><td>24 hours</td></tr>
          <tr><td>Holt Island</td><td>many different ${numberedSlot(31)}</td><td><span class="cbt-answer-control" data-control="pair" data-question-number="32" data-answer-keys="32a,32b"><strong class="cbt-blank-number">32</strong><span>between ${slot('32a')} and ${slot('32b')}</span></span></td></tr>
          <tr><td>Longfield Country Park</td><td>reconstruction of a 2,000-year-old ${numberedSlot(33)} with activities for children</td><td>daylight hours</td></tr>
        </tbody>
      </table>
    </div>
    <header class="cbt-section-intro is-compact"><span class="cbt-kicker">QUESTIONS 34–36</span><p>Choose the correct letter, A, B or C.</p></header>
    ${choiceQuestion(34, 'As part of Monday’s activity, visitors will', [['A', 'prepare food with herbs.'], ['B', 'meet a well-known herbalist.'], ['C', 'dye cloth with herbs.']])}
    ${choiceQuestion(35, 'For the activity on Wednesday,', [['A', 'only group bookings are accepted.'], ['B', 'visitors should book in advance.'], ['C', 'attendance is free.']])}
    ${choiceQuestion(36, 'For the activity on Saturday, visitors should', [['A', 'come in suitable clothing.'], ['B', 'make sure they are able to stay for the whole day.'], ['C', 'tell the rangers before the event what they wish to do.']])}
    <header class="cbt-section-intro is-compact"><span class="cbt-kicker">QUESTIONS 37–40</span><p>Label the map. Choose the correct letter, A–I.</p></header>
    <figure class="cbt-park-map" aria-label="Sơ đồ Hinchingbrooke Park với các vị trí A đến I">
      <img src="assets/figures/hinchingbrooke-park.png" width="1560" height="836" alt="Hinchingbrooke Park: bản đồ gốc với các vị trí A–I, hồ, cổng East gate và West gate, khu Refreshments và la bàn.">
    </figure>
    <div class="cbt-short-answer-list">
      ${textQuestion(37, 'bird hide')}
      ${textQuestion(38, 'dog-walking area')}
      ${textQuestion(39, 'flower garden')}
      ${textQuestion(40, 'wooded area')}
    </div>`;

  const domesticRobotsPassage = `
    <p class="cbt-passage-deck"><em>Machines that look after your home are getting cleverer, but they still need care and attention if they are to perform as intended.</em></p>
    <p>Floor-cleaning machines capable of responding to their environment were among the first commercially available domestic products worthy of being called robots. The best known is the Roomba, made by iRobot, an American company which has sold more than three million of the disc-shaped, frisbee-sized vacuuming robots. The latest model, the fifth version of the Roomba, has more sensors and cleverer software than its predecessors. Press the “Clean” button and the robot glides out of its docking station and sets off across the floor.</p>
    <p>Domestic robots are supposed to free up time so that you can do other things, but watching how the Roomba deals with obstacles is strangely compelling. It is capable of sensing its surroundings, and does not simply try to adhere to a pre-planned route, so it is not upset if furniture is moved, or if it is picked up and taken to clean another room. Its infra-red sensors enable it to slow down before reaching an obstacle - such as a dozy cat - changing direction and setting off again.</p>
    <p>It steadily works its way around the room, figuring out how to get out from under the television stand or untangle itself from a stray Game Boy recharging lead. Watch it for long enough, and you can sometimes predict its next move. The machine has a “dirt sensor” and flashes a blue light when it finds things to clean up. Only when it detects no more dirt does it stop going over the same area and, eventually, conclude that the whole room is clean. It then trundles back to dock at its recharging station.</p>
    <p>So the first observation of life with a domestic robot is that you will keep watching it before you trust it completely. Perhaps that is not surprising: after all, when automatic washing machines first appeared, people used to draw up a chair and sit and watch them complete their wash, rinse and spin cycles. Now they just load them, switch them on and leave them to it.</p>
    <p>The second observation is that, despite their current level of intelligence, certain allowances must be made to get the best out of a domestic robot. The Roomba can be set up to clean at particular times, and to clean more than one room (small infra-red “lighthouses” can be positioned in doorways, creating an invisible barrier between one room and the next that is only removed when the first room has been cleaned). A “drop-off” sensor underneath the robot prevents it from falling down stairs. All very clever, but what the Roomba will not do is pick up toys, shoes and other items left lying around. Rooms cared for by robots must be kept tidy. To start with, children will happily put things away in order to watch the robot set off, but unfortunately the novelty soon wears off.</p>
    <p>Similar allowances must be made for other domestic robots. Sweden’s Husqvarna recently launched a new version of its Automower lawn mowing robot. Before it can be used, a wire must be placed around the perimeter of the lawn to define the part to be cut. If toys and other obstacles are not cleared from the lawn before it starts work, the robot will steer around them, leaving uncut areas. However, the latest version can top up its batteries with solar power, or send its owner a text message if it gets into trouble trying to climb a mole-hill.</p>
    <p>But there is still only a limited range of domestic robots. Machines that mop the floor, clean a swimming pool and clear muck from guttering are made by iRobot. Several surveillance robots are also on offer. The Rovio, made by WowWee of Hong Kong, is a wi-fi-enabled webcam, mounted on an extending arm, which rides along smoothly on a nimble set of three wheels. Its movement can be remotely operated over the Internet via a laptop or mobile phone. The idea is that Rovio can patrol the home when its owner is away, either automatically or under manual control: in the latter case, two-way communication allows the operator to see and talk via the machine. So you could, for instance, shout at the cat if it is sleeping on your best sofa.</p>
    <p>Some machines are called robots even though they cannot move around. There is an ironing robot, for instance, that resembles an inflatable dummy: put a damp shirt on it, and it puffs up to remove the creases. Similarly, there are elaborate trouser presses that aspire to be robots. But do these devices really count as robots? If so, then surely dishwashers and washing machines do, too.</p>
    <p>Yet whatever shape or size robots come in, many will be adored. Another important observation from living with a robot is that it tends to become part of the family. “People give them names, and if they have to be sent back for repair, they carefully add a mark to them to ensure they get the same machine back,” says Nancy Dussault Smith of iRobot.</p>`;

  const domesticRobotsQuestions = `
    <header class="cbt-section-intro"><span>Questions 1–6</span><p>Do the following statements agree with the information in Reading Passage 1?</p><p><strong>TRUE</strong> if the statement agrees; <strong>FALSE</strong> if it contradicts; <strong>NOT GIVEN</strong> if there is no information.</p></header>
    ${choiceQuestion(1, 'Improvements have been made to Roomba over time.', [['TRUE','TRUE'],['FALSE','FALSE'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(2, 'Obstacles have to be removed from Roomba’s path.', [['TRUE','TRUE'],['FALSE','FALSE'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(3, 'Roomba keeps cleaning in one place until it thinks it is dirt free.', [['TRUE','TRUE'],['FALSE','FALSE'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(4, 'People once found washing machines as fascinating as robots.', [['TRUE','TRUE'],['FALSE','FALSE'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(5, 'Comparative studies are available on the intelligence of domestic robots.', [['TRUE','TRUE'],['FALSE','FALSE'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(6, 'Roomba tidies up a room as well as cleaning it.', [['TRUE','TRUE'],['FALSE','FALSE'],['NOT GIVEN','NOT GIVEN']], false)}
    <header class="cbt-section-intro is-compact"><span>Questions 7–10</span><p>Answer the questions. Use <strong>NO MORE THAN THREE WORDS</strong> from the passage.</p></header>
    ${textQuestion(7, 'What is used to mark out the mowing area for the Automower?')}
    ${textQuestion(8, 'What form of renewable energy can some Automowers use?')}
    ${textQuestion(9, 'What does the ironing robot look like?')}
    ${textQuestion(10, 'What do people often put on a robot when it is going to be repaired?')}
    <header class="cbt-section-intro is-compact"><span>Questions 11–13</span><p>Label the diagram. Choose <strong>NO MORE THAN THREE WORDS</strong> from the passage.</p></header>
    <figure class="cbt-rovio-diagram" aria-label="Sơ đồ chức năng của robot Rovio">
      <img src="assets/figures/rovio.png" width="1620" height="628" alt="The Rovio: hình gốc của robot, laptop và điện thoại, với mũi tên và ba nhãn cần điền cho câu 11–13.">
    </figure>
    <div class="cbt-diagram-answers" aria-label="Điền đáp án sơ đồ Rovio">
      <p>${numberedSlot(11)} holding webcam</p>
      <p>Wheel design allows easy ${numberedSlot(12)}</p>
      <p>Manual controls give home-owner ${numberedSlot(13)} with robot</p>
    </div>`;

  const setiPassage = `
    <p class="cbt-passage-deck"><em>The question of whether we are alone in the Universe has haunted humanity for centuries, but we may now stand poised on the brink of the answer to that question, as we search for radio signals from other intelligent civilisations. This search, often known by the acronym SETI (search for extra-terrestrial intelligence), is a difficult one. Although groups around the world have been searching intermittently for three decades, it is only now that we have reached the level of technology where we can make a determined attempt to search all nearby stars for any sign of life.</em></p>
    <section class="cbt-lettered-paragraph"><span>A</span><div><p>The primary reason for the search is basic curiosity - the same curiosity about the natural world that drives all pure science. We want to know whether we are alone in the Universe. We want to know whether life evolves naturally if given the right conditions, or whether there is something very special about the Earth to have fostered the variety of life forms that we see around us on the planet. The simple detection of a radio signal will be sufficient to answer this most basic of all questions. In this sense, SETI is another cog in the machinery of pure science which is continually pushing out the horizon of our knowledge.</p><p>However, there are other reasons for being interested in whether life exists elsewhere. For example, we have had civilisation on Earth for perhaps only a few thousand years, and the threats of nuclear war and pollution over the last few decades have told us that our survival may be tenuous. Will we last another two thousand years or will we wipe ourselves out? Since the lifetime of a planet like ours is several billion years, we can expect that, if other civilisations do survive in our galaxy, their ages will range from zero to several billion years. Thus any other civilisation that we hear from is likely to be far older, on average, than ourselves. The mere existence of such a civilisation will tell us that long-term survival is possible, and gives us some cause for optimism. It is even possible that the older civilisation may pass on the benefits of their experience in dealing with threats to survival such as nuclear war and global pollution, and other threats that we haven’t yet discovered.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>B</span><div><p>In discussing whether we are alone, most SETI scientists adopt two ground rules. First, UFOs (Unidentified Flying Objects) are generally ignored since most scientists don’t consider the evidence for them to be strong enough to bear serious consideration (although it is also important to keep an open mind in case any really convincing evidence emerges in the future). Second, we make a very conservative assumption that we are looking for a life form that is pretty well like us, since if it differs radically from us we may well not recognise it as a life form, quite apart from whether we are able to communicate with it. In other words, the life form we are looking for may well have two green heads and seven fingers, but it will nevertheless resemble us in that it should communicate with its fellows, be interested in the Universe, live on a planet orbiting a star like our Sun, and perhaps most restrictively, have a chemistry, like us, based on carbon and water.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>C</span><div><p>Even when we make these assumptions, our understanding of other life forms is still severely limited. We do not even know, for example, how many stars have planets, and we certainly do not know how likely it is that life will arise naturally, given the right conditions. However, when we look at the 100 billion stars in our galaxy (the Milky Way), and 100 billion galaxies in the observable Universe, it seems inconceivable that at least one of these planets does not have a life form on it; in fact, the best educated guess we can make, using the little that we do know about the conditions for carbon-based life, leads us to estimate that perhaps one in 100,000 stars might have a life-bearing planet orbiting it. That means that our nearest neighbours are perhaps 100 light years away, which is almost next door in astronomical terms.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>D</span><div><p>An alien civilisation could choose many different ways of sending information across the galaxy, but many of these either require too much energy, or else are severely attenuated while traversing the vast distances across the galaxy. It turns out that, for a given amount of transmitted power, radio waves in the frequency range 1000 to 3000 MHz travel the greatest distance, and so all searches to date have concentrated on looking for radio waves in this frequency range. So far there have been a number of searches by various groups around the world, including Australian searches using the radio telescope at Parkes, New South Wales. Until now there have not been any detections from the few hundred stars which have been searched.</p><p>The scale of the searches has been increased dramatically since 1992, when the US Congress voted NASA $10 million per year for ten years to conduct a thorough search for extra-terrestrial life. Much of the money in this project is being spent on developing the special hardware needed to search many frequencies at once. The project has two parts. One part is a targeted search using the world’s largest radio telescopes, the American-operated telescope in Arecibo, Puerto Rico and the French telescope in Nancy in France. This part of the project is searching the nearest 1000 likely stars with high sensitivity for signals in the frequency range 1000 to 3000 MHz. The other part of the project is an undirected search which is monitoring all of space with a lower sensitivity, using the smaller antennas of NASA’s Deep Space Network.</p></div></section>
    <section class="cbt-lettered-paragraph"><span>E</span><div><p>There is considerable debate over how we should react if we detect a signal from an alien civilisation. Everybody agrees that we should not reply immediately. Quite apart from the impracticality of sending a reply over such large distances at short notice, it raises a host of ethical questions that would have to be addressed by the global community before any reply could be sent. Would the human race face the culture shock if faced with a superior and much older civilisation? Luckily, there is no urgency about this. The stars being searched are hundreds of light years away, so it takes hundreds of years for their signal to reach us, and a further few hundred years for our reply to reach them. It’s not important, then, if there’s a delay of a few years, or decades, while the human race debates the question of whether to reply, and perhaps carefully drafts a reply.</p></div></section>`;

  const setiQuestions = `
    <header class="cbt-section-intro"><span>Questions 14–17</span><p>Choose the correct heading for paragraphs B–E from the list below.</p></header>
    <div class="cbt-option-bank cbt-heading-bank">
      <p><strong>i</strong> Seeking the transmission of radio signals from planets</p>
      <p><strong>ii</strong> Appropriate responses to signals from other civilisations</p>
      <p><strong>iii</strong> Vast distances to Earth’s closest neighbours</p>
      <p><strong>iv</strong> Assumptions underlying the search for extra-terrestrial intelligence</p>
      <p><strong>v</strong> Reasons for the search for extra-terrestrial intelligence</p>
      <p><strong>vi</strong> Knowledge of extra-terrestrial life forms</p>
      <p><strong>vii</strong> Likelihood of life on other planets</p>
    </div>
    <div class="cbt-short-answer-list">
      ${textQuestion(14, 'Paragraph B')}${textQuestion(15, 'Paragraph C')}${textQuestion(16, 'Paragraph D')}${textQuestion(17, 'Paragraph E')}
    </div>
    <header class="cbt-section-intro is-compact"><span>Questions 18–20</span><p>Answer the questions. Choose <strong>NO MORE THAN THREE WORDS AND/OR A NUMBER</strong> from the passage.</p></header>
    ${textQuestion(18, 'What is the life expectancy of Earth?')}
    ${textQuestion(19, 'What kind of signals from other intelligent civilisations are SETI scientists searching for?')}
    ${textQuestion(20, 'How many stars are the world’s most powerful radio telescopes searching?')}
    <header class="cbt-section-intro is-compact"><span>Questions 21–26</span><p>Do the statements agree with the views of the writer? Choose YES, NO or NOT GIVEN.</p></header>
    ${choiceQuestion(21, 'Alien civilisations may be able to help the human race to overcome serious problems.', [['YES','YES'],['NO','NO'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(22, 'SETI scientists are trying to find a life form that resembles humans in many ways.', [['YES','YES'],['NO','NO'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(23, 'The Americans and Australians have co-operated on joint research projects.', [['YES','YES'],['NO','NO'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(24, 'So far SETI scientists have picked up radio signals from several stars.', [['YES','YES'],['NO','NO'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(25, 'The NASA project attracted criticism from some members of Congress.', [['YES','YES'],['NO','NO'],['NOT GIVEN','NOT GIVEN']], false)}
    ${choiceQuestion(26, 'If a signal from outer space is received, it will be important to respond promptly.', [['YES','YES'],['NO','NO'],['NOT GIVEN','NOT GIVEN']], false)}`;

  window.K56_TERM_TEST_CONTENT = Object.freeze({
    variant: 'semantic-html',
    baseTestSlug: 'term-test-1-k56',
    audio: {
      src: 'assets/private/listening-k56.mp3',
      label: 'Term Test 1 · Khóa 56 · Listening',
      durationLabel: 'khoảng 31 phút'
    },
    listening: {
      instructions: [
        'Bài nghe gồm 4 phần. Hoàn thành bước kiểm tra âm thanh trước khi bắt đầu.',
        'Không tải lại hoặc đóng tab khi audio đang phát.',
        'Câu 32 có hai ô và chỉ được tính đúng khi cả hai ô đều đúng.'
      ],
      sections: [
        { label: 'Part 1', range: 'Questions 1–10', html: listeningPart1 },
        { label: 'Part 2', range: 'Questions 11–20', html: listeningPart2 },
        { label: 'Part 3', range: 'Questions 21–30', html: listeningPart3 },
        { label: 'Part 4', range: 'Questions 31–40', html: listeningPart4 }
      ]
    },
    reading: {
      instructions: [
        'Bạn có 40 phút để hoàn thành 2 passages và 26 câu.',
        'Passage và câu hỏi có khung cuộn riêng.',
        'Còn 10 phút đồng hồ sẽ chuyển đỏ; hết giờ hệ thống tự nộp bài.'
      ],
      sections: [
        {
          label: 'Passage 1',
          title: 'Domestic robots',
          range: 'Questions 1–13',
          passageHtml: domesticRobotsPassage,
          questionsHtml: domesticRobotsQuestions
        },
        {
          label: 'Passage 2',
          title: 'Is there anybody out there? · The Search for Extra-terrestrial Intelligence',
          range: 'Questions 14–26',
          passageHtml: setiPassage,
          questionsHtml: setiQuestions
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
          prompt: 'Although more and more people read the news on the Internet, newspapers will remain the main source of news for the majority of people.',
          followUp: 'To what extent do you agree or disagree?'
        }
      ]
    }
  });
}());
