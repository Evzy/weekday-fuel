/* Measured extras per meal portion (generated). Regenerate: node scripts/build-extra-amounts.mjs */
(function (root) {
  "use strict";
  var EXTRA_AMOUNTS = {
  "toasty": {
    "sourdough": {
      "L": 0,
      "S": 0,
      "X": 84
    },
    "spray": {
      "L": 1,
      "S": 0,
      "X": 0
    },
    "butter": {
      "L": 0,
      "S": 5,
      "X": 5
    }
  },
  "eggmuffin": {
    "spray": {
      "L": 1,
      "S": 1,
      "X": 1
    },
    "tomsauce": {
      "L": 15,
      "S": 15,
      "X": 15,
      "_ml": true
    },
    "butter": {
      "L": 0,
      "S": 0,
      "X": 5
    }
  },
  "brekwrap": {
    "spray": {
      "L": 1,
      "S": 1,
      "X": 1
    }
  },
  "tenderwrap": {
    "lightmayo": {
      "L": 0,
      "S": 0,
      "X": 15
    }
  },
  "burritobowl": {
    "avocado": {
      "L": 0,
      "S": 0,
      "X": 70
    }
  },
  "teriyaki": {
    "sesameseed": {
      "L": 0,
      "S": 3,
      "X": 3
    },
    "kewpie": {
      "L": 0,
      "S": 0,
      "X": 15
    }
  },
  "buffalomac": {
    "paprika": {
      "L": 1,
      "S": 1,
      "X": 1,
      "_ml": false
    },
    "tasty": {
      "L": 0,
      "S": 0,
      "X": 50
    },
    "garlic": {
      "L": 5,
      "S": 5,
      "X": 5,
      "_ml": false
    }
  },
  "schnitzel": {
    "spray": {
      "L": 1,
      "S": 1,
      "X": 1
    },
    "butter": {
      "L": 0,
      "S": 0,
      "X": 10
    }
  },
  "koreanbeef": {
    "spray": {
      "L": 0,
      "S": 1,
      "X": 1
    }
  },
  "bolognese": {
    "olive": {
      "L": 0,
      "S": 0,
      "X": 5,
      "_ml": true
    }
  },
  "redcurry": {
    "fishsauce": {
      "L": 5,
      "S": 5,
      "X": 5,
      "_ml": true
    }
  },
  "friedrice": {
    "spray": {
      "L": 1,
      "S": 1,
      "X": 0
    },
    "vegoil": {
      "L": 0,
      "S": 0,
      "X": 10,
      "_ml": true
    }
  }
};
  var api = { EXTRA_AMOUNTS: EXTRA_AMOUNTS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WeekdayFuelExtraAmounts = api;
})(this);
