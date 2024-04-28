

require('dotenv').config();
const axios = require('axios');
const jsonfile = require('jsonfile');
const axiosRetry = require('axios-retry').default;

var testVariable = process.env.TEST_VARIABLE;
var sw_access_key = process.env.SW_ACCESS_KEY;
var shopUrl = process.env.SHOP_URL;
var shopFolder = shopUrl.replace('https://', '');

var shopwareApiInstance = axios.create({
    //baseURL: 'https://'+process.env.SHOP_NAME+'.myshopify.com/admin/api/'+process.env.API_VERSION+'/', //products.json
    baseURL: shopUrl,
    timeout: 60000,
    responseType: 'json', // default
    validateStatus: true, //never throw error?
    validateStatus: function (status) {
        return status >= 200 && status <= 500; // default
    },
    
    headers: {
        'Content-Type': 'application/json'
    },
    params: {

    }
});


axiosRetry(shopwareApiInstance, { 
    retries: 3,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => {
        return retryCount * 4000;
    },
    onRetry: (retryCount, error, requestConfig) => {
        console.error('axiosRetry: retryCount, errorCode, errorMessage:', retryCount, error.code, error.message);
        return;
    }
});


var storeApiParams = {
    includes: {
        product: [
            'id', 'productNumber', 'active',// 
            'name', 'description', 'translated.name', 'translated.description', //'translated',
            'ean', 'availableStock', 'deliveryTime', 'minPurchase', 'restockTime',
            'cover', 'media',
            'calculatedPrice', 'calculatedPrices',
            'parentId', 'childCount', 'options',
            'seoCategory', 'seoUrls',
            'customFields',
            'translated.customFields',
        //'customFields.custom_googleshopping_feed_bild', //'customFields.custom_googleshopping_feed_bild', 'translated.customFields.custom_googleshopping_feed_bild', 
        //'customFields.custom_link_productcustomization', //'translated.customFields.custom_link_productcustomization', 'customFields.custom_link_productcustomization',
        ],
        delivery_time: ['id'],
        product_media: ['media'], 
        media: ['url'],  
        category: ['breadcrumb'],
        seo_url: ['seoPathInfo'],  //TODO: full url ist not set?
        calculated_price: ['unitPrice', 'price', 'listPrice'],
        property_group_option: ['group', 'translated', 'name'], 
        property_group: ['translated.name', 'name'],
    },
    associations: {
        media: {limit: 10},
        options: {limit: 10,
            associations: {
                group: {limit: 10},
                media: {limit: 10},
            }
        },
        
    }
};


async function swStoreApiGet(path, params, includeStoreApiParams = true) {
    //TODO: config: merge configs
    if(includeStoreApiParams){
        params.includes = storeApiParams.includes;
        params.associations = storeApiParams.associations;
    }

    var response = await shopwareApiInstance.get('/store-api/'+path, {
        headers: {
            'sw-access-key': `${sw_access_key}`,
            'sw-include-seo-urls': 1,
        },
        params: params,
    });

    return response;
}


function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}


async function saveEntityPart(entity, page, data){

    data = mapEntityData(data, entity);

    jsonfile.writeFileSync(`data/${shopFolder}/${entity}/${page}.json`, data);
}


async function getEntityPart(entity, page){
    var data = jsonfile.readFileSync(`data/${shopFolder}/${entity}/${page}.json`, {throws: false});
    return data;
}


/*
async function processProducts(page, limit){

    var status = null;
    if(page === 300) {console.log('the END'); return;}
    var productData = await getEntityPart('products', page);
    if(productData){
        //console.log('STATUS: product store has part', page);
        status = 100;
    }
    else {
        await wait(3000);
        var productResponse = await swStoreApiGet('product', {
            page: page,
            limit: limit,
        });

        status = productResponse.status;
        productData = productResponse.data;
        
        if(status !== 200){
            console.log('ERROR: status, page ', status, page); 
            return; 
        }
        else {
            await saveEntityPart('products', page, productData);
        }
    }
    
    var total = productData.total;

    console.log('STATUS:', productData.page, productData.limit, productData.total, status);

    if(total > 0 & total === limit){// and total === limit -> next page exists
        await processProducts(page+1, limit);
    }
    else {
        console.log('STATUS: reached the end of products');
    }

}
*/


async function processEntity(entity_type){

    var page = 1;
    var limit = 100;

    console.log(`processing entity: ${entity_type}, page: ${page}, limit: ${limit}`);

    await processEntityPart(entity_type, page, limit);
}


async function processEntityPart(entity_type, page, limit){

    var status = null;
    //if(page === 2) {console.log('the END'); return;}
    var entityData = await getEntityPart(entity_type, page); //null; //
    if(entityData){
        //console.log('STATUS: entity store has part', entity_type, page);
        status = 0;
    }
    else {
        if(page != 1){
            await wait(3000);
        }
        
        var entityResponse = await swStoreApiGet(entity_type, {
            page: page,
            limit: limit,
            'total-count-mode': 2,
        });

        status = entityResponse.status;
        entityData = entityResponse.data;
        
        if(status !== 200){
            console.log(`ERROR: STATUS - page ${page}, limit ${limit}, total ${total}, status ${status}`); 
            return; 
        }
        
        if(entityData.total > 0){
            await saveEntityPart(entity_type, page, entityData);
            //console.log(`ERROR: TOTAL - page ${page}, limit ${limit}, total ${total}, status ${status}`); 
            //return; 
        }
        
    }
    
    var total = entityData.total;

    console.log(`STATUS: page ${page}, limit ${limit}, total ${total}, status ${status}`);
    //entityData.page, entityData.limit, entityData.total, 

    //TODO: next page exists?
    if(total > 0 & total >= limit){// and total === limit -> next page exists
        await processEntityPart(entity_type, page+1, limit);
    }
    else {
        console.log(`STATUS: reached the end of products. page: ${page}, limit: ${limit}, total: ${total}`);
    }
}


function mapEntityData(data, entity){

    if(entity === 'product'){
        data.elements = data.elements.map(element => {
            /*
            element.translated.customFields = {
                custom_googleshopping_feed_bild: element.translated.customFields.custom_googleshopping_feed_bild,
            };
            */

            element.customFields = null;

            var images = element.media.map(media => {
                return media.media.url;
            });

            var options = element.options.map(option => {
                return {
                    name: option.translated.name,
                    group_name: option.group.translated.name,
                };
            });

            var seoUrl = element.seoUrls.length > 0 ? element.seoUrls[0].seoPathInfo : null;
            var breadcrumb = element.seoCategory?.breadcrumb || null;

            var newElement = {
                active: element.active,
                productNumber: element.productNumber,
                parentId: element.parentId,
                childCount: element.childCount,

                id: element.id,
                name: element.translated.name,
                description: element.translated.description,
                googleshopping_feed_bild: element.translated.customFields?.custom_googleshopping_feed_bild || null,
                ean: element.ean,
                availableStock: element.availableStock,
                minPurchase: element.minPurchase,
                restockTime: element.restockTime,
                deliveryTime: element.deliveryTime,
                image: element.cover?.media?.url || null,
                images: images,
                options: options,
                seoUrl: seoUrl,
                breadcrumb: breadcrumb,
                calculatedPrice: element.calculatedPrice,
                calculatedPrices: element.calculatedPrices,
            };

            return newElement;
        });
    }
    
    return data;
};


async function getProductCount(){

    var entity_type = 'product';
    var page = 76219-1;
    var limit = 1;

    var entityResponse = await swStoreApiGet(entity_type, {
        page: page,
        limit: limit,
        'total-count-mode': 1,
        includes: {
            product: ['id'],
        }
    }, false);

    var status = entityResponse.status;
    var entityData = entityResponse.data;

    if(status !== 200){
        console.log(`ERROR - getProductCount: status ${status}`);
        return -1; 
    }
    
    var count = entityData.total;

    console.log(`STATUS - getProductCount: ${count}`);//, JSON.stringify(entityData)
}


(async () => {
    //axios code: ECONNABORTED, AxiosError: timeout of 60000ms exceeded
    //var entityData = await getEntityPart('product', 1);console.log(entityData);
    //axios: code: 'ECONNRESET'. Error: socket hang up, ECONNRESET

    var count = await getProductCount();
    //return;
    
    var entity_type = 'product';
    await processEntity(entity_type);

    //console.log('test: ', testVariable);
})()