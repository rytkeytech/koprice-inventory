// Text of the Koprice user guide. Edit here, then run `npm run guide`.
// Block types: p (paragraph), steps (numbered), bullets, tip, warn, rule, h2, table, pagebreak.
// Button and screen names are written exactly as they appear in the app.

export const APP_URL = "koprice.netlify.app";

export const sections = [
  {
    title: "Getting started",
    who: "Everyone",
    blocks: [
      { h2: "What Koprice does" },
      {
        p: "Koprice records every sale, every delivery and every cedi that comes into the shop. The owner can see it all from a phone, even when away from the shop. Attendants sell on the shop phones; the app works out prices, change and stock by itself.",
      },
      { h2: "Put Koprice on the phone" },
      {
        steps: [
          `Open Chrome on the phone and go to ${APP_URL}`,
          "Tap the menu (three dots, top right).",
          "Tap Add to Home screen, then Add.",
          "From now on, open Koprice from the KP icon on the home screen.",
        ],
      },
      { h2: "Create your account (new staff)" },
      {
        steps: [
          "Open Koprice and tap Create an account.",
          "Type your full name, phone number, email and a password (at least 8 characters).",
          "Tap Create account. You will see Waiting for owner approval.",
          "Tell the owner. Once the owner approves you, tap Check again and you are in.",
        ],
      },
      { tip: "Use your own email and keep your password secret. Everything you do in the app is recorded under your name." },
      { h2: "Logging in and out" },
      {
        bullets: [
          "Log in with your email and password.",
          "Forgot your password? Tap Forgot password?, type your email, and open the link sent to your email.",
          "To log out, tap the arrow-out icon at the top right.",
        ],
      },
    ],
  },
  {
    title: "Selling",
    who: "Attendants and owner",
    blocks: [
      { p: "Tap Sell at the bottom of the screen. (The owner taps the orange Sell button at the top.)" },
      { h2: "Add items to the sale" },
      {
        bullets: [
          "Search: type part of the name, for example milo, then tap the size you are selling: the single item (sachet, tin, bottle) or the pack (Bag, Carton, Crate).",
          "Scan: tap Scan and point the camera at the barcode. A barcode scanner plugged into the phone also works.",
          "Quick sell: tap the big buttons for items you sell often, like sachet water.",
          "Change the number with − and +, or tap the number and type it.",
        ],
      },
      { h2: "Retail or Wholesale" },
      {
        p: "Choose Retail or Wholesale at the top before you take payment. Wholesale prices only apply from the wholesale quantity set by the owner. Below that, the app charges the retail price and tells you.",
      },
      { h2: "Take payment" },
      { p: "Tap the orange Take payment button. Choose how the customer pays:" },
      {
        bullets: [
          "Cash: type the money the customer gave you (or tap GH₵ 20, GH₵ 50…). The app shows the change to give.",
          "MoMo: type the MoMo transaction ID from the payment message.",
          "Credit (pay later): choose the customer, or tap Add new customer.",
          "Split: part cash, part MoMo, part credit. The app shows what is still left to pay.",
        ],
      },
      { steps: ["Check the total.", "Tap Complete sale.", "Give the change shown on the screen."] },
      { warn: "Always type the real MoMo transaction ID. The owner checks MoMo IDs against the MoMo account." },
      { h2: "Receipt" },
      {
        p: "After the sale you see the receipt number. To send the receipt, type the customer's WhatsApp number and tap Send on WhatsApp. Tap New sale for the next customer.",
      },
      { h2: "Discounts and credit over the limit" },
      {
        p: "Attendants cannot give discounts or let a customer owe more than their credit limit on their own. Type a reason and tap Send to owner for approval.",
      },
      {
        rule: "If the screen says Waiting for owner approval, do not hand over the goods. Nothing leaves stock until the owner approves.",
      },
      { h2: "Not enough stock" },
      {
        p: "If the app says Not enough stock, the system thinks the shop does not have that many. Count the shelf. If the stock is really there, tell the owner so the stock can be corrected.",
      },
    ],
  },
  {
    title: "Credit customers",
    who: "Attendants and owner",
    blocks: [
      {
        p: "Credit means the customer takes goods now and pays later. Each customer has a credit limit set by the owner. New customers start with no credit limit until the owner sets one.",
      },
      { h2: "A customer pays back what they owe" },
      {
        steps: [
          "Go to My day and tap Customer paying back credit.",
          "Find the customer.",
          "Type the amount paid, choose Cash or MoMo (type the MoMo ID).",
          "Tap Save payment. The app shows how much they still owe.",
        ],
      },
      { tip: "Cash paid back by customers is added to the cash you hand over at the end of the day." },
    ],
  },
  {
    title: "Receiving goods",
    who: "Attendants and owner",
    blocks: [
      { p: "When a supplier delivers goods, record them at once so stock is correct." },
      {
        steps: [
          "Tap Receive goods at the bottom.",
          "Choose the supplier, or tap + New supplier.",
          "Tap Take photo of invoice and photograph the supplier's invoice.",
          "Search or scan each item. Choose the pack or single item and type how many came.",
          "Add a note if something is damaged or missing.",
          "Tap Save delivery.",
        ],
      },
      {
        p: "Stock goes up straight away so you can keep selling. The owner checks the delivery and the invoice later. If the owner has a question, you will see Owner has a question under My recent deliveries.",
      },
      { warn: "Count what really arrived. Do not copy the invoice if the numbers are different. Write the difference in the note." },
    ],
  },
  {
    title: "My day and closing the day",
    who: "Attendants",
    blocks: [
      {
        p: "My day shows your sales today, the cash and MoMo you took, credit given, and the most important figure: Cash to hand over. The app works this out by itself from your sales.",
      },
      { h2: "Close your day (every evening)" },
      {
        steps: [
          "Tap My day.",
          "Count the cash you have.",
          "Choose Put in shop safe or Sent by MoMo (type the MoMo ID).",
          "Type the amount you are handing over.",
          "If it is different from Cash to hand over, write why in the note.",
          "Tap Close my day, then Yes, close my day.",
        ],
      },
      { rule: "You can only close each day once. Check the amount before you confirm." },
      { h2: "Other things on My day" },
      {
        bullets: [
          "My sales today: tap a sale to see it, resend the receipt, or ask the owner to refund or cancel it.",
          "Ask the owner: report damaged, expired or missing stock, or a price that is wrong.",
          "Money spent for the shop: record money you paid out, for example transport. The owner confirms it.",
          "If a stock count is open, a yellow banner appears. Tap it to help count.",
        ],
      },
    ],
  },
  {
    title: "Stock counts",
    who: "Attendants and owner",
    blocks: [
      {
        p: "The owner starts a stock count. A spot count checks a few products; a full count checks everything. Counting helps find missing stock.",
      },
      {
        steps: [
          "Open the count (from the banner on My day).",
          "For each product, count what is really on the shelf and in the store.",
          "Type the full packs (for example bags) and the loose items, then tap Save.",
          "Use Not counted to see what is left.",
        ],
      },
      { tip: "Count carefully and honestly. You will not see what the system expects; just count what you see." },
    ],
  },
  {
    title: "What attendants cannot do",
    who: "Attendants",
    blocks: [
      { p: "To protect the shop and the staff, only the owner can:" },
      {
        bullets: [
          "change prices or give discounts",
          "let a customer owe more than their credit limit",
          "refund or cancel a sale",
          "remove damaged, expired or missing stock",
          "see cost prices and profit",
          "confirm deliveries, cash-ups and expenses",
        ],
      },
      { p: "Attendants can ask for any of these. The owner sees the request under Approvals and decides. Nothing is ever deleted: every sale and change is kept." },
    ],
  },
  {
    title: "Owner: Home and Approvals",
    who: "Owner",
    blocks: [
      { h2: "Home" },
      {
        bullets: [
          "Today's sales, compared with yesterday, split into Cash, MoMo and Credit.",
          "Profit today (sales minus the cost of goods sold).",
          "Cards for things waiting for you, missing stock, low stock and cash shortages. Tap a card to open it.",
          "Check these today: discounts, refunds, cancelled sales, write-offs and credit over the limit.",
          "Sales by attendant, with what each one usually sells in a day.",
          "End of day (top right): a summary you can share on WhatsApp.",
        ],
      },
      { h2: "Approvals" },
      { p: "Everything waiting for you is here." },
      {
        bullets: [
          "Requests from staff: read the reason, then tap Approve or Reject. Approving carries it out at once.",
          "Deliveries to check: look at the invoice photo, type the cost of each item, then Confirm (or Query and say what is wrong).",
          "Cash-ups to confirm: count the money you received and type it. If it is less than expected, the app records a shortage.",
          "Expenses to confirm: confirm or reject money staff spent for the shop.",
        ],
      },
      { tip: "Typing the cost when you confirm a delivery keeps profit and missing-stock values correct." },
    ],
  },
  {
    title: "Owner: Stock",
    who: "Owner",
    blocks: [
      { h2: "Add a product" },
      {
        steps: [
          "Stock → Add product.",
          "Type the name, choose the category, and the smallest unit you sell (sachet, bottle, tin…).",
          "Type the retail and wholesale price for ONE unit, and from how many the wholesale price applies.",
          "Tap Add a pack if it is also sold as a Bag, Carton or Crate: type how many units are in the pack and its prices.",
          "Type the cost price (for one unit or one pack) and how much stock you have now.",
          "Tap Save product.",
        ],
      },
      { h2: "Load many products from Excel" },
      {
        steps: [
          "Stock → Import from Excel → Download Excel template.",
          "Fill in one row per product (the help sheet explains each column).",
          "Choose the file. The app lists any problems with the row number.",
          "Fix the problems in Excel, choose the file again, then tap Import.",
        ],
      },
      { h2: "Stock counts and missing stock" },
      {
        bullets: [
          "Stock counts → Start a count: choose Spot count (a few products, good on every visit) or Full count.",
          "When counting is done, tap Finish and correct stock, or Finish, just record.",
          "Missing stock shows what went missing, valued at cost price, and which attendants were on duty.",
          "Damaged / expired removes spoilt or missing stock, with a note.",
        ],
      },
      { tip: "Do a spot count of 10 fast-selling items on every visit. Missing stock shows up quickly." },
    ],
  },
  {
    title: "Owner: Money and Reports",
    who: "Owner",
    blocks: [
      { h2: "Money" },
      {
        bullets: [
          "Money owed: who owes, how much and for how many days. Tap Remind to send a WhatsApp message, or Record payment.",
          "Customers: add customers, set credit limits, and see each customer's statement.",
          "Cash-ups: every day's cash from each attendant, with shortages per attendant.",
          "Expenses: rent, electricity, transport, salaries. Add your own; confirm staff ones.",
        ],
      },
      { h2: "Reports" },
      {
        bullets: [
          "Choose Today, This week or This month. Figures are compared with the period before.",
          "Daily sales chart (green = retail, orange = wholesale). Tap a bar to see the numbers.",
          "Best sellers, slow movers (stock not selling), and sales per attendant.",
          "Download Excel saves everything, including every sale, to the phone.",
        ],
      },
      { h2: "Refund or cancel a sale" },
      {
        p: "Open the sale (from Approvals or Reports) and tap Refund (goods came back) or Cancel sale (entered by mistake). Give a reason. Stock comes back and any credit is taken off the customer. The app tells you how much money to give back.",
      },
    ],
  },
  {
    title: "Owner: Settings",
    who: "Owner",
    blocks: [
      { p: "Tap the gear icon at the top right." },
      {
        bullets: [
          "Staff: approve new sign-ups as attendant or owner, change roles, or Turn off access for someone who leaves.",
          "Shop details: shop name, phone, MoMo number and the message at the bottom of receipts.",
          "Categories and Suppliers: add, rename or hide.",
          "Audit log: every sensitive change, who did it and when. Nobody can change or delete it.",
          "Change my password.",
        ],
      },
      { warn: "When an attendant leaves, or a phone is lost, turn off their access in Settings → Staff straight away." },
    ],
  },
  {
    title: "Daily routine",
    who: "Everyone",
    blocks: [
      {
        table: [
          ["When", "Who", "What to do"],
          ["Opening", "Attendant", "Open Koprice and check you are logged in as yourself."],
          ["Every sale", "Attendant", "Record it in the app, even small ones. Type MoMo IDs."],
          ["Delivery", "Attendant", "Receive goods, with a photo of the invoice."],
          ["Closing", "Attendant", "Count the cash, then Close my day."],
          ["Every day", "Owner", "Look at Home: sales, cash split and Check these today."],
          ["Each visit", "Owner", "Approvals, confirm cash-ups, one spot count."],
          ["Each month", "Owner", "Reports for the month, then Download Excel."],
        ],
      },
    ],
  },
  {
    title: "Problems and answers",
    who: "Everyone",
    blocks: [
      { h2: "There is no internet" },
      { p: "Koprice needs internet to sell. Check mobile data or Wi-Fi. If a sale was not saved, write it down and enter it when the internet is back." },
      { h2: "I entered a sale wrongly" },
      { p: "Open it from My day and tap Ask to cancel sale with the reason. The owner cancels it. Never sell again to cover it up." },
      { h2: "The screen says Waiting for owner approval" },
      { p: "Your account is new or your access was turned off. Ask the owner to approve you in Settings → Staff." },
      { h2: "Cash is short at the end of the day" },
      { p: "Hand over what you have and explain in the note. Check today's sales list in My day for mistakes." },
      { h2: "Something else is wrong" },
      { p: "Take a screenshot of the screen and send it to RYT KEY TECH (contact below)." },
    ],
  },
];

export const support = {
  name: "RYT KEY TECH",
  phone: "054 957 2669",
  email: "rytkeytech@gmail.com",
};
