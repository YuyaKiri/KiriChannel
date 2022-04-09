'use strict';

const express = require('express');
const line = require('@line/bot-sdk');
const request = require('request');

const NEW_LINE = '\n';
const LINE_MESSAGE_MAX_LENGTH = 000;

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});


// Process in Linebot
function handleEvent(event) {

  console.log('handleEvent()');

  if (event.type !== 'message') {
    return Promise.resolve(null);
  }

  let message = '';

  const text = (event.message.type === 'text') ? event.message.text : '';

  if (text.endsWith('とは')) {
    const length = 'とは'.length;
    const word = text.slice(0, -length);
    
    lookUpWords(event.source.userId, word);

    message = 'ちょっと待ってね';

  } else if (text == 'ヘルプ') {
    message += '「[単語]とは」と入力するとWikipediaで単語を調べるよ';

  } else if (text != '') {
    message += '「[調べたい単語]とは」と入力してみてね';
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: message
  });
}
//*******************************************************************


// Define lookUpWords
const lookUpWords = async (userId, word) => {

  console.log('lookUpWords()');

  const options = {
    url: 'https://ja.wikipedia.org/w/api.php',
    qs: {
      format: 'json',
      action: 'query',
      redirects: 1,
      list: 'search',
      srsearch: word,
      srlimit: 3,           // 検索結果の最大取得件数
      prop: 'extracts',
      exchars: 200,         // 説明文の最大文字列長
      explaintext: 1,
    }
  };

  request(options, function(err, response, result) {

    let message = '';

    if(!err && response.statusCode == 200) {
      const json = JSON.parse(result);
      const search = json.query.search;
      const wikiURL = 'https://ja.wikipedia.org/wiki/';

      const mainTitle = '[検索結果]' + NEW_LINE;
      message = mainTitle;

      Object.keys(search).some(function(key) {
        if (key == -1) {
          message = 'ごめんなさい。' + NEW_LINE;
          message += '該当ワードはありません。';
          return true;
        }

        const item = search[key];
        if (item.title && item.snippet) {
          let itemMessage = '';

          if (message != mainTitle) {
            itemMessage = NEW_LINE;
            itemMessage += NEW_LINE;
          }

          const title =  item.title;
          let summary = item.snippet;
          summary = summary.replace(/<span class="searchmatch">/g, '');
          summary = summary.replace(/<\/span>/g , '');

          // Word
          itemMessage += '◆' + title + 'とは' + NEW_LINE;

          // Explanatory text
          itemMessage += summary + NEW_LINE;

          // URL
          itemMessage += NEW_LINE;
          itemMessage += encodeURI(wikiURL + title);

          if ((message.length + itemMessage.length) > LINE_MESSAGE_MAX_LENGTH) {
            return true;
          } 

          message += itemMessage;
        }
      });

    if (message == mainTitle) {
      message = 'ごめんなさい。' + NEW_LINE;
      message += '該当ワードはありません。';
    }

    console.log('message=' + NEW_LINE);
    console.log(message);

  } else {
    message = 'ごめんなさい。' + NEW_LINE;
    message += 'エラーが発生しました。';
    console.log('error!');
    console.log('err:' + err + ', response.statusCode:' + response.statusCode);
  }

  client.pushMessage(userId, {
    type: 'text',
    text: message
  });
}).setMaxListeners(10);
}
//**********************************************************************


// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
