import 'reflect-metadata'
import { VssueAPI } from 'vssue'
import { inspect, InspectOptions } from 'util'
import { AxiosError } from 'axios'

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
	breaks: true,
	linkify: true,
});

let inspectOptions: InspectOptions = {
	colors: true,
	getters: true,
};

/**
 * {
	"id": 1702924,
	"login": "demogitee",
	"name": "demogitee",
	"avatar_url": "https://gitee.com/assets/no_portrait.png",
	"url": "https://gitee.com/api/v5/users/demogitee",
	"html_url": "https://gitee.com/demogitee",
	"followers_url": "https://gitee.com/api/v5/users/demogitee/followers",
	"following_url": "https://gitee.com/api/v5/users/demogitee/following_url{/other_user}",
	"gists_url": "https://gitee.com/api/v5/users/demogitee/gists{/gist_id}",
	"starred_url": "https://gitee.com/api/v5/users/demogitee/starred{/owner}{/repo}",
	"subscriptions_url": "https://gitee.com/api/v5/users/demogitee/subscriptions",
	"organizations_url": "https://gitee.com/api/v5/users/demogitee/orgs",
	"repos_url": "https://gitee.com/api/v5/users/demogitee/repos",
	"events_url": "https://gitee.com/api/v5/users/demogitee/events{/privacy}",
	"received_events_url": "https://gitee.com/api/v5/users/demogitee/received_events",
	"type": "User",
	"site_admin": false,
	"blog": null,
	"weibo": null,
	"bio": null,
	"public_repos": 2,
	"public_gists": 0,
	"followers": 23,
	"following": 0,
	"stared": 0,
	"watched": 3,
	"created_at": "2017-12-26T21:01:33+08:00",
	"updated_at": "2019-05-22T00:46:12+08:00",
}
 */
export interface IUser
{
	"id": number;
	"login": string;
	"name": string;
	"avatar_url": string;
	"url": string;
	"html_url": string;
	"followers_url": string;
	"following_url": string;
	"gists_url": string;
	"starred_url": string;
	"subscriptions_url": string;
	"organizations_url": string;
	"repos_url": string;
	"events_url": string;
	"received_events_url": string;
	"type": string;
	"site_admin": boolean;
	"blog": any;
	"weibo": any;
	"bio": any;
	"public_repos": number;
	"public_gists": number;
	"followers": number;
	"following": number;
	"stared": number;
	"watched": number;
	"created_at": string;
	"updated_at": string;
}

export interface IIssues
{
	"id": number;
	"url": string;
	"repository_url": string;
	"labels_url": string;
	"comments_url": string;
	"html_url": string;
	"parent_url": any;
	"number": string;
	"state": string;
	"title": string;
	"body": string;
	"user": {
		"id": number;
		"login": string;
		"name": string;
		"avatar_url": string;
		"url": string;
		"html_url": string;
		"followers_url": string;
		"following_url": string;
		"gists_url": string;
		"starred_url": string;
		"subscriptions_url": string;
		"organizations_url": string;
		"repos_url": string;
		"events_url": string;
		"received_events_url": string;
		"type": string;
		"site_admin": boolean;
	};
	"labels": any[];
	"assignee": any;
	"collaborators": any[];
	"repository": {
		"id": number;
		"full_name": string;
		"human_name": string;
		"url": string;
		"namespace": {
			"id": number;
			"type": string;
			"name": string;
			"path": string;
			"html_url": string;
		};
		"path": string;
		"name": string;
		"owner": {
			"id": number;
			"login": string;
			"name": string;
			"avatar_url": string;
			"url": string;
			"html_url": string;
			"followers_url": string;
			"following_url": string;
			"gists_url": string;
			"starred_url": string;
			"subscriptions_url": string;
			"organizations_url": string;
			"repos_url": string;
			"events_url": string;
			"received_events_url": string;
			"type": string;
			"site_admin": boolean;
		};
		"description": string;
		"private": boolean;
		"public": boolean;
		"internal": boolean;
		"fork": boolean;
		"html_url": string;
		"ssh_url": string;
		"forks_url": string;
		"keys_url": string;
		"collaborators_url": string;
		"hooks_url": string;
		"branches_url": string;
		"tags_url": string;
		"blobs_url": string;
		"stargazers_url": string;
		"contributors_url": string;
		"commits_url": string;
		"comments_url": string;
		"issue_comment_url": string;
		"issues_url": string;
		"pulls_url": string;
		"milestones_url": string;
		"notifications_url": string;
		"labels_url": string;
		"releases_url": string;
		"recommend": boolean;
		"homepage": any;
		"language": string;
		"forks_count": number;
		"stargazers_count": number;
		"watchers_count": number;
		"default_branch": string;
		"open_issues_count": number;
		"has_issues": boolean;
		"has_wiki": boolean;
		"pull_requests_enabled": boolean;
		"has_page": boolean;
		"license": any;
		"outsourced": boolean;
		"project_creator": string;
		"members": string[];
		"pushed_at": string;
		"created_at": string;
		"updated_at": string;
		"parent": any;
		"paas": any;
	};
	"milestone": any;
	"created_at": string;
	"updated_at": string;
	"plan_started_at": any;
	"deadline": any;
	"finished_at": any;
	"scheduled_time": number;
	"comments": number;
	"issue_type": string;
	"program": any;
}

export function handleAvatar(avatar: string)
{
	return avatar
}

export function normalizeUser(user: IUser | IComment["user"]): VssueAPI.User
{
	return {
		username: user.login,
		avatar: handleAvatar(user.avatar_url),
		homepage: user.html_url,
	}
}

export function normalizeIssue(issue: IIssues): VssueAPI.Issue
{
	return {
		id: issue.number,
		title: issue.title,
		content: issue.body,
		link: issue.url,
	}
}

export interface IComment
{
	"id": number;
	"body": string;
	"user": {
		"id": number;
		"login": string;
		"name": string;
		"avatar_url": string;
		"url": string;
		"html_url": string;
		"followers_url": string;
		"following_url": string;
		"gists_url": string;
		"starred_url": string;
		"subscriptions_url": string;
		"organizations_url": string;
		"repos_url": string;
		"events_url": string;
		"received_events_url": string;
		"type": string;
		"site_admin": boolean;
	};
	"source": string;
	"created_at": string;
	"target": {
		"issue": {
			"id": number;
			"number": string;
			"title": string;
		};
		"pull_request": any;
	};
}

export function normalizeComment(comment: IComment): VssueAPI.Comment
{
	console.log(md.render(comment.body));

	return {
		id: comment.id as any,
		content: md.render(comment.body),
		contentRaw: comment.body,
		author: normalizeUser(comment.user),
		createdAt: comment.created_at,
		updatedAt: comment.created_at,
		//reactions: normalizeReactions(comment.reactionGroups),
	}
}

export function normalizeReactions(reactions: any): VssueAPI.Reactions
{
	return {
		like: reactions.find(item => item.content === 'THUMBS_UP').users.totalCount,
		unlike: reactions.find(item => item.content === 'THUMBS_DOWN').users.totalCount,
		heart: reactions.find(item => item.content === 'HEART').users.totalCount,
	}
}

export function mapReactionName(reaction: keyof VssueAPI.Reactions): string
{
	if (reaction === 'like') return 'THUMBS_UP'
	if (reaction === 'unlike') return 'THUMBS_DOWN'
	if (reaction === 'heart') return 'HEART'
	return reaction
}

export default {
	normalizeUser,
	normalizeIssue,
	normalizeComment,
	normalizeReactions,
	mapReactionName,
}

export const enum EnumMyConst
{
	SITE_NAME = 'Gitee',
	BASE_URL = 'https://gitee.com'
}

export function logParamTypes(target: any, key: string)
{
	let types = Reflect.getMetadata("design:paramtypes", target, key);
	let s = types.map(a => a.name).join();
	console.log(`${key} param types: ${s}`);
}

export function logParameter(target: any, key: string, index: number)
{
	let metadataKey = `__log_${key}_parameters`;
	if (Array.isArray(target[metadataKey]))
	{
		target[metadataKey].push(index);
	}
	else
	{
		target[metadataKey] = [index];
	}
}

export function logMethod(target, key, descriptor)
{

	if (descriptor === undefined)
	{
		descriptor = Object.getOwnPropertyDescriptor(target, key);
	}
	let originalMethod = descriptor.value;

	//editing the descriptor/value parameter
	descriptor.value = function (...args: any[])
	{

		let metadataKey = `__log_${key}_parameters`;
		let indices = target[metadataKey];

		if (Array.isArray(indices))
		{
			for (let i = 0; i < args.length; i++)
			{

				if (indices.indexOf(i) !== -1)
				{

					let arg = args[i];
					let argStr = JSON.stringify(arg) || arg.toString();
					console.log(`${key} arg[${i}]: ${argStr}`);
				}
			}
			let result = originalMethod.apply(this, args);
			return result;
		}
		else
		{

			let a = args.map(a => (inspect(a, {
				showHidden: true,
			})));
			let result = originalMethod.apply(this, args);

			if (result instanceof Promise)
			{
				return result
					.then(result =>
					{
						let r = inspect(result, inspectOptions);
						console.log(`Call: ${key}\n(${a})\n=> Promise(${r})`);
						return result;
					})
					.catch(e =>
					{

						let r = inspect(e, inspectOptions);

						console.error(`Call Failed: ${key}\n(${a})\n=> Promise(${r})`);

						return Promise.reject(e)
					})
			}
			else
			{
				let r = inspect(result, inspectOptions);
				console.log(`Call: ${key}\n(${a})\n=> ${r}`);
			}

			return result;
		}
	}

	// return edited descriptor as opposed to overwriting the descriptor
	return descriptor;
}

export function noticeError(target, key, descriptor)
{
	if (descriptor === undefined)
	{
		descriptor = Object.getOwnPropertyDescriptor(target, key);
	}
	let originalMethod = descriptor.value;

	descriptor.value = function (...args: any[])
	{
		let result;
		try
		{
			result = originalMethod.apply(this, args);

			if (result instanceof Promise)
			{
				result = result.catch((e: AxiosError) =>
				{

					noticeAxiosError(e);

					return Promise.reject(e)
				})
			}
		}
		catch (e)
		{
			noticeAxiosError(e)
			throw e
		}

		return result
	}
}

export function noticeAxiosError(e: AxiosError & {
	noticed?: boolean;
})
{
	if (e && !e.noticed && e.response && e.response.data)
	{
		e.noticed = true;

		setTimeout(() =>
		{
			window.alert(`${e.message}\n${inspect(e.response.data)}`);
		}, 100);
	}
}
