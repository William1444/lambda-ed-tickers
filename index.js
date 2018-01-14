const cloudscraper =require('cloudscraper');
// telegram
const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_BOT_TOKEN']);
const TELEGRAM_BOT_CHAT_ID = process.env['TELEGRAM_BOT_CHAT_ID'];
console.info(TELEGRAM_BOT_CHAT_ID)


var AWS = require('aws-sdk');
AWS.config.update({region: 'eu-west-2'});
const ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});

const tickerParam = ticker => ({
  TableName: 'ed-tickers',
  Item: {
    'ticker': {
      S: ticker
    }
  }
})

const updateTicker = (ticker) => new Promise((acc, rej) => ddb.putItem(tickerParam(ticker), function(err, data) {
  if (err) {
    console.log("Error updating dynamodb", err);
    rej(err);
  } else {
    acc(data)
  }
}))

// GET tickers from dynamodb
exports.handler = () => {
  cloudscraper.get('https://etherdelta.com/config/main.json', function(error, response, body) {
    if (error) {
      console.log('Error occurred', JSON.stringify(error));
    } else {
      ddb.scan({TableName: 'ed-tickers'}, function(err, data) {
        if (err) {
          console.log("Error", err);
        } else {
          const existingTokens = data.Items
            .map(t => t.ticker.S);
          const currentTokens = JSON.parse(body).tokens;
          const newTokenNames = currentTokens
            .map(({name}) => name)
            .filter(name => existingTokens.indexOf(name) < 0)
          if (newTokenNames.length > 0) {
            console.info(newTokenNames)
            slimbot.sendMessage(TELEGRAM_BOT_CHAT_ID, "New tokens added to ED: \n" + newTokenNames.join('\n'))
              .then(() => Promise.all(newTokenNames.map(t => updateTicker(t))))
              .then(() => slimbot.sendMessage(TELEGRAM_BOT_CHAT_ID, "updated tickers"))
              .catch(e => slimbot.sendMessage(TELEGRAM_BOT_CHAT_ID, "couldn\'t update tickers"));
          }
        }
      });
    }
  });
};
