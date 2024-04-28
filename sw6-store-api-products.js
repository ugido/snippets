

require('dotenv').config();
const axios = require('axios');
const jsonfile = require('jsonfile');


var testVariable = process.env.TEST_VARIABLE;
var sw_access_key = process.env.SW_ACCESS_KEY;
var shopUrl = process.env.SHOP_URL;
var shopFolder = shopUrl.replace('https://', '');

var shopwareApiInstance = axios.create({
    //baseURL: 'https://'+process.env.SHOP_NAME+'.myshopify.com/admin/api/'+process.env.API_VERSION+'/', //products.json
    baseURL: shopUrl,
    timeout: 60000,
    responseType: 'json', // default
    validateStatus: false,
    validateStatus: function (status) {
        return status >= 200 && status <= 500; // default
    },
    headers: {
        'Content-Type': 'application/json'
    },
    params: {

    }
});


async function swStoreApiGet(path, params) {
    //TODO: config: merge configs
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


async function processEntity(entity_type){

    var page = 1;
    var limit = 100;

    console.log('processing entity, page, limit: ', entity_type, page, limit);

    await processEntityPart(entity_type, page, limit);
}


async function processEntityPart(entity_type, page, limit){

    var status = null;
    //if(page === 2) {console.log('the END'); return;}
    var entityData = await getEntityPart(entity_type, page); //null; //
    if(entityData){
        //console.log('STATUS: entity store has part', entity_type, page);
        status = 100;
    }
    else {
        if(page != 1){
            await wait(3000);
        }
        
        var entityResponse = await swStoreApiGet(entity_type, {
            page: page,
            limit: limit,
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
        });

        status = entityResponse.status;
        entityData = entityResponse.data;
        
        if(status !== 200){
            console.log('ERROR: status, page ', status, page); 
            return; 
        }
        else {
            await saveEntityPart(entity_type, page, entityData);
        }
    }
    
    var total = entityData.total;

    console.log('STATUS:', entityData.page, entityData.limit, entityData.total, status);

    if(total > 0 & total === limit){// and total === limit -> next page exists
        await processEntityPart(entity_type, page+1, limit);
    }
    else {
        console.log('STATUS: reached the end of products');
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


(async () => {
    //axios code: ECONNABORTED, AxiosError: timeout of 60000ms exceeded
    //var entityData = await getEntityPart('product', 1);console.log(entityData);

    var entity_type = 'product';
    await processEntity(entity_type);

    //await processProducts(page, limit);
    //console.log('test: ', testVariable);
})()