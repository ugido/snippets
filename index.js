require('dotenv').config()
const puppeteer = require('puppeteer')
const express = require('express')
const app = express()
const axios = require('axios')

const port = process.env.PORT

var waitForAnySelector = (page, selectors) => new Promise((resolve, reject) => {
  let hasFound = false
  selectors.forEach(selector => {
    page.waitForSelector(selector, {visible: true})
      .then(() => {
        if (!hasFound) {
          hasFound = true
          resolve(selector)
        }
      })
      .catch((error) => {
        // console.log('Error while looking up selector ' + selector, error.message)
      })
  })
})

app.get('/', (req, res) => {
  const url = req.query.url
 // res.send('url: '+url)  
 const apiKey = req.query.apiKey
 if(apiKey !== process.env.TEST_KEY) return res.send('not authenticated!')
 console.log('if you see this, its bad...')
 res.send('Hello World! testKey: '+process.env.TEST_KEY)
})

app.get('/game', (req, res) => {
  (async () => {
    const url = req.query.url;
    //const username = process.env.ELVENAR_USERNAME;
    //const password = process.env.ELVENAR_PASSWORD;
    const username = req.query.username || process.env.ELVENAR_USERNAME;
    const password = req.query.password || process.env.ELVENAR_PASSWORD;

    if(!url){
      return res.send({'data': 'url missing!'})
    }

    var requests = [];
    var manifests = null;
    var dailyReward = null;
    var seasonal_events = null;
    var timestamp = null;

    const extensionsToLog = ['mo', 'json', 'js'];

    const browser = await puppeteer.launch({
      headless: false,
      args: ['--use-gl=egl'],
    });

    const page = await browser.newPage();

    page.on('response', async (response) => {
      
      var request = response.request()

      var url = request.url()


      /*
      var url = request.url()
      if(request.isNavigationRequest()){
        console.log('request.isNavigationRequest: ', url);
        if(page.mainFrame() === request.frame()){
          console.log('request for main frame');
        }
      }
        //console.log('request.isNavigationRequest: ', url);

        if(url.endsWith('/game/race')){
          console.log('url includes /game/race', page.url(), url);
          //await page.waitForSelector('.race_selector', {visible: true});
          //await page.click('.race_selector a');
        }
        */
      
      //var method = request.method()
      var requestData = request.postData()
      var resourceType = request.resourceType()
      //var responseUrl = response.url()
      var extension = response.url().split('.').pop();
      if(resourceType === 'document'){
        console.log('document url: ', url);
      }

      if(resourceType === 'xhr' && request.method() === 'POST'){
        if(requestData.includes('getManifests')){//ManifestService
          var responseData =  await response.json()

          manifests = responseData.find(a => a.requestMethod === 'getManifests').responseData
          //manifests = responseData.filter(a => a.requestMethod === getManifests).responseData
          console.log('manifest request found')
        }
        if(requestData.includes('StartupService')){//StartupService -> seasonal_events 
          console.log('StartupService found')
          var responseData = await response.json()
          
          var dailyRewards = responseData.find(a => a.requestMethod === 'getRewards' && a.requestClass === "EpisodicRewardsService")

          if(dailyRewards){
            dailyReward = dailyRewards.responseData[0]
          }


          var seasonalEventsObject = responseData
              .find(a => a.requestMethod === 'getData' && a.requestClass === "StartupService")
              
          if(seasonalEventsObject){
            seasonal_events = seasonalEventsObject.responseData.seasonal_events
            timestamp = Date.now()
            console.log('seasonal_events. timestamp: '+timestamp)
          }


          //dailyReward = responseData[0]
          //var dailyRewards = responseData.find(a => a.requestMethod === 'getRewards').responseData
          //dailyReward = dailyRewards
          /*
          if(dailyRewards){
            dailyReward = dailyRewards[0]
          }
          */

        }
      }
        //console.log(responseUrl);
        //console.log(resourceType, responseUrl, requestData);
        if(extensionsToLog.includes(extension)){
          //requests.push(response.url())
        }
        requests.push(response.url())
      
      //TODO:  log event dates, manifests for ch19,...,
    })

    /*
    page.on('framenavigated', async frame => {
        const url = frame.url(); // the new url

        if(page.url().endsWith('/game/race')){//includes
          console.log('url includes /game/race', page.url());
          await page.waitForSelector('.race_selector', {visible: true});
          await page.click('.race_selector a');
        }
        else {
          console.log('url doesnt include /game/race', page.url());
        }
        // do something here...
    })
    */

    await page.goto(url);
    await page.waitForSelector('.login-form', {visible: true});
    console.log('loaded .login-form');
    await page.type('#login_userid', username);
    await page.type('#login_password', password);
    await page.click('#login_Login');

    var firstSelector = await waitForAnySelector(page, [
      '.worlds',
      '.race_selector'
    ]);

    if(firstSelector === '.race_selector'){
      console.log('loaded .race_selector');
      await page.waitForSelector('.race_selector a', {visible: true});
      await page.click('.race_selector a');
    }

    if(firstSelector === '.worlds'){
      const [worldRequest] = await Promise.all([
        //page.waitForNavigation(),
        page.waitForRequest(request => {
          var url = request.url();
          var isGet = request.method() === 'GET';
          var isGameOrRace = url.endsWith('/game/race') || url.endsWith('/game');
          if(isGameOrRace){
            console.log('isGet url: ', url);
          }
          return isGet && isGameOrRace;
        }),
        
        page.click('.worlds a')
      ]);

      if(worldRequest.url().endsWith('/game/race')){
        console.log('url includes /game/race', page.url());
        await page.waitForSelector('.race_selector a', {visible: true});
        console.log('loaded .race_selector');
        await page.click('.race_selector a');
      }
      else {
        console.log('url doesnt include /game/race', page.url());
      }
    }

    

    
    
    /*
    await page.waitForSelector('.worlds', {visible: true});//, timeout: 60000
    console.log('loaded .worlds');
    //await page.click('.worlds a');

    
    
    */
    /**/
    
    /**/
    //1. world selection OR Race selection
    //2. race selection or game 
    //await page.$('#idProductType')) || 
    /*
    if(worldRequest.url().endsWith('/game/race')){
      console.log('url includes /game/race', page.url());
      await page.waitForSelector('.race_selector a', {visible: true});
      console.log('loaded .race_selector');
      await page.click('.race_selector a');
    }
    else {
      console.log('url doesnt include /game/race', page.url());
    }
    */

    /*
    await page.waitForNavigation({
      waitUntil: 'networkidle0',
    });
    */

    await page.waitForSelector('#game_body', {visible: true});

    console.log('loaded #game_body');

    var gameVars = await page.evaluate(() => gameVars);
    var content = await page.content();

    const finalResponse = await page.waitForResponse(async (response) => {
      var method = response.request().method()
      var requestData = response.request().postData()

      return (method === 'POST' && requestData.includes('logGameLogin'))
    });

    await browser.close();

    console.log('BROWSER CLOSED!')

    
    var gameData = {
      url: url,
      variables: gameVars,
      content: content,
      requests: requests,
      manifests: manifests,
      dailyReward: dailyReward,
      seasonalEvents: seasonal_events,
      timestamp: timestamp,
    };

    
    try {
      var axiosResponse = await axios.post(process.env.ELVENFAN_UPDATE_URL, {
        'data': gameData,
        'url': url,
        'key': process.env.ELVENFAN_KEY,
      })

      //console.log(axiosResponse);
    } catch(error) {
      console.log(error)
    }   
    
    

    res.json({'data': gameData});
})();
})

app.get('/versions', (req, res) => {
    
    (async () => {
        const url = 'https://beta.elvenar.com';

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        
        const versionNames = await page.$$eval('.pb-lang-sec-options ul li a span', (spans) =>
            spans.map((span) => span.textContent)
        );

        await browser.close();
        res.json({'data': versionNames});
    })();
})

app.get('/htmltopdf', (req, res) => {
  
 (async () => {
   const url = req.query.url
   const html = req.query.html
   const format = (req.query.format || 'a4').toUpperCase()
   const orientation = req.query.orientation || ''
   const landscape = orientation === 'landscape'
   const mediaType = req.query.mediaType || 'screen'

   const allowedMediaTypes = ['print', 'screen']
 
   const apiKey = req.query.apiKey
   if(apiKey !== 'test482'){
         return res.send('not authenticated!')
   }   
   console.log('first log..') 
   const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--font-render-hinting=none',  
      ],
    });
    
    try {
     
      const page = await browser.newPage()
     
     if(url){
        await page.goto(url)
      }
      else {
        await page.setContent(html)
      }
     
      if(allowedMediaTypes.includes(mediaType)) {

        await page.emulateMediaType(mediaType)
      }

      const pdf = await page.pdf({
        printBackground: true,
        format: format, 
        landscape: landscape,
      })

      res.contentType("application/pdf")
        res.send(pdf)
      console.log('try block log')
    } catch (e) {
      console.log(e)
    } finally {
      console.log('finally block log')
      await browser.close()
    }
  })();
})

app.listen(port, () => {
  //console.log(puppeteer.defaultArgs());
    console.log(`Example app listening at http://localhost:${port}`)
})

/*
const puppeteer = require('puppeteer');

(async () => {
    console.time('test');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    
    const url = 'https://example.com';

    try {
      const page = await browser.newPage();
     // url = req.query.url;
      await page.goto(url);
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
     
      //res.send(bodyHTML);
      console.log(bodyHTML);
      await page.screenshot({ path: 'example.png' });
      await page.pdf({ path: 'hn.pdf', format: 'a4' });
      console.timeEnd('test');
    } catch (e) {
      console.log(e);
    } finally {
      await browser.close();
    }
  })();
*/
