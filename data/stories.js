// Curated text for the replay cases. Round numbers in `r` are 0-based indices into the logged
// rounds; the page displays them as r + 1. Every statement here was checked against the logged
// actions, belief records and simulator event logs of the episode.
window.BA = window.BA || { cases: {} };
BA.stories = [
  {
    id: 'trigger_rule__Ihlen_1_int_s45',
    tab: 'Trigger rule',
    paper: true,
    lead: 'Gather seven foods onto a breakfast table. Three are shut in cupboards; four sit on a table in another room. An unseen housemate moves one item whenever something sets him off: onto the table if it already holds an item, otherwise away to his own spot.',
    hidden: 'The housemate acts each time the robot opens a cupboard it has not opened before.',
    focus: 'housemate',
    compare: 'pce',
    moments: [
      { r: 5, title: 'Room entry ruled out', text: 'Nothing has moved while the robot walked through several rooms, so BeliefAct sets “walking into a particular room” to 0.' },
      { r: 15, title: 'Destination found', text: 'The breakfast table is in a bedroom. BeliefAct brings an item there first, so that any move the housemate makes will go to the table.' },
      { r: 19, title: 'Placement ruled out', text: 'Placing the bell pepper and waiting a round moves nothing. “Placing an item on the table” drops to 0; “opening a new cupboard” rises to 0.7 in the next round.' },
      { r: 22, title: 'Opening cupboards on purpose', text: 'With two items on the table, BeliefAct opens a cupboard and then the fridge. The housemate carries the mussel, then the feta, to the table.', focus: 'dest' },
      { r: 25, title: 'Rule confirmed', text: '“Each time a new container is opened” is marked supported; the fixed rhythm is ruled out.' },
    ],
  },
  {
    id: 'induction__Merom_0_int_s16',
    tab: 'Food splitting rule',
    paper: true,
    lead: 'Split eight foods equally between two countertops. Each countertop starts with one example food; a hidden food attribute decides which side every other food belongs on.',
    hidden: 'The split is by preparation: cooked foods (arepa, apple pie, cinnamon roll, fried chicken) on one side, manufactured foods (prosciutto, sugar cookie, date, dried apricot) on the other.',
    focus: 'rule',
    compare: 'naive',
    moments: [
      { r: 3, title: 'First hypothesis', text: 'Seeing arepa on one countertop and prosciutto on the other, BeliefAct proposes “baked goods versus the rest” and sorts by it.' },
      { r: 20, title: 'Expected outcome not observed', text: 'All eight foods are placed, four per side, but the task does not end. The hypothesis predicted completion, so BeliefAct revises the rule to “hot dishes versus cold or shelf-stable foods” and swaps fried chicken and the sugar cookie.' },
      { r: 23, title: 'Split complete', text: 'The swap completes the split in 24 rounds. The three baselines use all 200 rounds and make 65 to 88 placements each.', focus: 'agent' },
    ],
  },
  {
    id: 'visitor_intent__Rs_garden_s04',
    tab: 'Visitor intent',
    paper: true,
    lead: 'Gather six foods onto a breakfast table. A visitor also moves items, following a pattern the robot is not told: helping, taking items away, or moving them between other surfaces.',
    hidden: 'The visitor takes items off the breakfast table and leaves them on the coffee table in the garden.',
    focus: 'other',
    compare: 'bsg',
    moments: [
      { r: 4, title: 'An item leaves the table', text: 'The visitor takes the chocolate-chip cookie to the garden. BeliefAct has not seen this; its belief still favors “not interfering”.', focus: 'dest' },
      { r: 16, title: 'Belief revised', text: 'BeliefAct finds the waffle on the garden coffee table and revises its belief: the visitor moves items from the breakfast table to the garden coffee table.' },
      { r: 22, title: 'Collecting from the garden', text: 'From here BeliefAct fetches items directly from the garden coffee table and finishes at round 28.' },
    ],
  },
  {
    id: 'unstable_spot__Rs_garden_s04',
    tab: 'Unstable storage',
    lead: 'Store six foods on any of three storage spots and declare completion. One spot loses items while it is out of view; completion counts only if every item is stored and no removal is pending.',
    hidden: 'The living-room coffee table is the spot that loses items.',
    focus: 'spot',
    compare: 'naive',
    moments: [
      { r: 1, title: 'Bagel on the coffee table', text: 'BeliefAct, like every baseline, first stores the bagel on the living-room coffee table.' },
      { r: 3, title: 'The bagel is removed', text: 'While the robot is out of the room, the bagel is moved off the coffee table.', focus: 'agent' },
      { r: 13, title: 'Spot identified', text: 'Back in the living room, BeliefAct sees that the bagel is no longer on the coffee table. It marks the coffee table as the spot that loses items and the other two as safe.' },
      { r: 27, title: 'Declared done, correctly', text: 'Every item is on the breakfast table. BeliefAct declares completion at round 28. The three baselines declared completion after 14 or 15 rounds with items still left on the coffee table.' },
    ],
  },
  {
    id: 'trigger_rule__Wainscott_0_garden_s25',
    tab: 'Trigger rule II',
    lead: 'The same task family as the first replay, in a larger house with a garden: gather seven foods onto a breakfast table while an unseen housemate moves one item whenever something sets him off.',
    hidden: 'The housemate acts each time the robot puts an item on the table that was not on it before.',
    focus: 'housemate',
    compare: 'naive',
    moments: [
      { r: 5, title: 'First item on the table', text: 'BeliefAct places the first item; the housemate carries the scoop of ice cream to the table.', focus: 'dest' },
      { r: 7, title: 'Rule identified', text: '“Each time an item is placed on the table” rises to 0.85 and is marked supported; in the next round “opening a new container” is ruled out.' },
      { r: 9, title: 'Using the rule', text: 'Each further placement sets the housemate off again; he carries the hard-boiled egg to the table. BeliefAct finishes at round 19.', focus: 'dest' },
    ],
  },
  {
    id: 'visitor_intent__Beechwood_0_int_s38',
    tab: 'Visitor intent II',
    lead: 'Gather six foods onto a breakfast table while a visitor moves items by an undisclosed pattern.',
    hidden: 'The visitor works against the robot: it moves items between surfaces and takes items off the table to the dining-room coffee table.',
    focus: 'agent',
    compare: 'bsg',
    moments: [
      { r: 25, title: 'Destination found', text: 'After ruling out several rooms, BeliefAct finds the breakfast table in the kitchen.' },
      { r: 38, title: 'Belief revised', text: 'BeliefAct finds the apple and the garlic back on the dining-room coffee table and concludes that the visitor takes items off the table (0.95, then supported).' },
    ],
  },
  {
    id: 'object_search__Pomaria_0_int_05',
    tab: 'Object search',
    lead: 'Find and pick up a bottle of face cream that is somewhere outside the starting room.',
    hidden: 'The bottle is on a countertop in the private office.',
    focus: 'face',
    compare: 'naive',
    moments: [
      { r: 1, title: 'Starting room ruled out', text: 'One look around the bedroom rules it out; BeliefAct turns to the rooms behind its doors.' },
      { r: 53, title: 'Found', text: 'BeliefAct finds the bottle in the private office and picks it up at round 54.', focus: 'agent' },
    ],
  },
];
