/*
 * Copyright 2010-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const url = require('url');
const HttpsProxyAgent = require('https-proxy-agent');
const websocket = require('websocket-stream');

const proxy = process.env.http_proxy;
const proxy_usr = process.env.http_proxy_username;
const proxy_psw = process.env.http_proxy_password;

function buildBuilder(client, opts) {
	if(proxy) {
		console.log('using proxy server %j', proxy);
		var options = url.parse(proxy);
		if(proxy_usr && proxy_psw) {
			console.log('using proxy username & password');
			options.auth = proxy_usr + ':' + proxy_psw;
		}
		var agent = new HttpsProxyAgent(options);
		opts.websocketOptions.agent = agent;
	}
	else
		console.log('http_proxy is not defined. create web socket without proxy');
	return websocket(opts.url, ['mqttv3.1'], opts.websocketOptions);
}

module.exports = buildBuilder;
