import 'reflect-metadata';
import { inspect } from 'util';
import MarkdownIt from 'markdown-it';
const md = new MarkdownIt({
    breaks: true,
    linkify: true,
});
let inspectOptions = {
    colors: true,
    getters: true,
};
export function handleAvatar(avatar) {
    return avatar;
}
export function normalizeUser(user) {
    return {
        username: user.login,
        avatar: handleAvatar(user.avatar_url),
        homepage: user.html_url,
    };
}
export function normalizeIssue(issue) {
    return {
        id: issue.number,
        title: issue.title,
        content: issue.body,
        link: issue.url,
    };
}
export function normalizeComment(comment) {
    console.log(md.render(comment.body));
    return {
        id: comment.id,
        content: md.render(comment.body),
        contentRaw: comment.body,
        author: normalizeUser(comment.user),
        createdAt: comment.created_at,
        updatedAt: comment.created_at,
    };
}
export function normalizeReactions(reactions) {
    return {
        like: reactions.find(item => item.content === 'THUMBS_UP').users.totalCount,
        unlike: reactions.find(item => item.content === 'THUMBS_DOWN').users.totalCount,
        heart: reactions.find(item => item.content === 'HEART').users.totalCount,
    };
}
export function mapReactionName(reaction) {
    if (reaction === 'like')
        return 'THUMBS_UP';
    if (reaction === 'unlike')
        return 'THUMBS_DOWN';
    if (reaction === 'heart')
        return 'HEART';
    return reaction;
}
export default {
    normalizeUser,
    normalizeIssue,
    normalizeComment,
    normalizeReactions,
    mapReactionName,
};
export var EnumMyConst;
(function (EnumMyConst) {
    EnumMyConst["SITE_NAME"] = "Gitee";
    EnumMyConst["BASE_URL"] = "https://gitee.com";
})(EnumMyConst || (EnumMyConst = {}));
export function logParamTypes(target, key) {
    let types = Reflect.getMetadata("design:paramtypes", target, key);
    let s = types.map(a => a.name).join();
    console.log(`${key} param types: ${s}`);
}
export function logParameter(target, key, index) {
    let metadataKey = `__log_${key}_parameters`;
    if (Array.isArray(target[metadataKey])) {
        target[metadataKey].push(index);
    }
    else {
        target[metadataKey] = [index];
    }
}
export function logMethod(target, key, descriptor) {
    if (descriptor === undefined) {
        descriptor = Object.getOwnPropertyDescriptor(target, key);
    }
    let originalMethod = descriptor.value;
    //editing the descriptor/value parameter
    descriptor.value = function (...args) {
        let metadataKey = `__log_${key}_parameters`;
        let indices = target[metadataKey];
        if (Array.isArray(indices)) {
            for (let i = 0; i < args.length; i++) {
                if (indices.indexOf(i) !== -1) {
                    let arg = args[i];
                    let argStr = JSON.stringify(arg) || arg.toString();
                    console.log(`${key} arg[${i}]: ${argStr}`);
                }
            }
            let result = originalMethod.apply(this, args);
            return result;
        }
        else {
            let a = args.map(a => (inspect(a, {
                showHidden: true,
            })));
            let result = originalMethod.apply(this, args);
            if (result instanceof Promise) {
                return result
                    .then(result => {
                    let r = inspect(result, inspectOptions);
                    console.log(`Call: ${key}\n(${a})\n=> Promise(${r})`);
                    return result;
                })
                    .catch(e => {
                    let r = inspect(e, inspectOptions);
                    console.error(`Call Failed: ${key}\n(${a})\n=> Promise(${r})`);
                    return Promise.reject(e);
                });
            }
            else {
                let r = inspect(result, inspectOptions);
                console.log(`Call: ${key}\n(${a})\n=> ${r}`);
            }
            return result;
        }
    };
    // return edited descriptor as opposed to overwriting the descriptor
    return descriptor;
}
export function noticeError(target, key, descriptor) {
    if (descriptor === undefined) {
        descriptor = Object.getOwnPropertyDescriptor(target, key);
    }
    let originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        let result;
        try {
            result = originalMethod.apply(this, args);
            if (result instanceof Promise) {
                result = result.catch((e) => {
                    noticeAxiosError(e);
                    return Promise.reject(e);
                });
            }
        }
        catch (e) {
            noticeAxiosError(e);
            throw e;
        }
        return result;
    };
}
export function noticeAxiosError(e) {
    if (e && !e.noticed && e.response && e.response.data) {
        e.noticed = true;
        setTimeout(() => {
            window.alert(`${e.message}\n${inspect(e.response.data)}`);
        }, 100);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLGtCQUFrQixDQUFBO0FBRXpCLE9BQU8sRUFBRSxPQUFPLEVBQWtCLE1BQU0sTUFBTSxDQUFBO0FBRzlDLE9BQU8sVUFBVSxNQUFNLGFBQWEsQ0FBQztBQUVyQyxNQUFNLEVBQUUsR0FBRyxJQUFJLFVBQVUsQ0FBQztJQUN6QixNQUFNLEVBQUUsSUFBSTtJQUNaLE9BQU8sRUFBRSxJQUFJO0NBQ2IsQ0FBQyxDQUFDO0FBRUgsSUFBSSxjQUFjLEdBQW1CO0lBQ3BDLE1BQU0sRUFBRSxJQUFJO0lBQ1osT0FBTyxFQUFFLElBQUk7Q0FDYixDQUFDO0FBaU1GLE1BQU0sVUFBVSxZQUFZLENBQUMsTUFBYztJQUUxQyxPQUFPLE1BQU0sQ0FBQTtBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLElBQThCO0lBRTNELE9BQU87UUFDTixRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUs7UUFDcEIsTUFBTSxFQUFFLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3JDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtLQUN2QixDQUFBO0FBQ0YsQ0FBQztBQUVELE1BQU0sVUFBVSxjQUFjLENBQUMsS0FBYztJQUU1QyxPQUFPO1FBQ04sRUFBRSxFQUFFLEtBQUssQ0FBQyxNQUFNO1FBQ2hCLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztRQUNsQixPQUFPLEVBQUUsS0FBSyxDQUFDLElBQUk7UUFDbkIsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHO0tBQ2YsQ0FBQTtBQUNGLENBQUM7QUFxQ0QsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE9BQWlCO0lBRWpELE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUVyQyxPQUFPO1FBQ04sRUFBRSxF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Y0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFMUMsSUFBSSxNQUFNLFlBQVksT0FBTyxFQUM3QjtnQkFDQyxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQWEsRUFBRSxFQUFFO29CQUd2QyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFcEIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUN6QixDQUFDLENBQUMsQ0FBQTthQUNGO1NBQ0Q7UUFDRCxPQUFPLENBQUMsRUFDUjtZQUNDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFBO1lBQ25CLE1BQU0sQ0FBQyxDQUFBO1NBQ1A7UUFFRCxPQUFPLE1BQU0sQ0FBQTtJQUNkLENBQUMsQ0FBQTtBQUNGLENBQUM7QUFFRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsQ0FFaEM7SUFFQSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksRUFDcEQ7UUFDQyxDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUVqQixVQUFVLENBQUMsR0FBRyxFQUFFO1lBRWYsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzNELENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztLQUNSO0FBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAncmVmbGVjdC1tZXRhZGF0YSdcbmltcG9ydCB7IFZzc3VlQVBJIH0gZnJvbSAndnNzdWUnXG5pbXBvcnQgeyBpbnNwZWN0LCBJbnNwZWN0T3B0aW9ucyB9IGZyb20gJ3V0aWwnXG5pbXBvcnQgeyBBeGlvc0Vycm9yIH0gZnJvbSAnYXhpb3MnXG5cbmltcG9ydCBNYXJrZG93bkl0IGZyb20gJ21hcmtkb3duLWl0JztcblxuY29uc3QgbWQgPSBuZXcgTWFya2Rvd25JdCh7XG5cdGJyZWFrczogdHJ1ZSxcblx0bGlua2lmeTogdHJ1ZSxcbn0pO1xuXG5sZXQgaW5zcGVjdE9wdGlvbnM6IEluc3BlY3RPcHRpb25zID0ge1xuXHRjb2xvcnM6IHRydWUsXG5cdGdldHRlcnM6IHRydWUsXG59O1xuXG4vKipcbiAqIHtcblx0XCJpZFwiOiAxNzAyOTI0LFxuXHRcImxvZ2luXCI6IFwiZGVtb2dpdGVlXCIsXG5cdFwibmFtZVwiOiBcImRlbW9naXRlZVwiLFxuXHRcImF2YXRhcl91cmxcIjogXCJodHRwczovL2dpdGVlLmNvbS9hc3NldHMvbm9fcG9ydHJhaXQucG5nXCIsXG5cdFwidXJsXCI6IFwiaHR0cHM6Ly9naXRlZS5jb20vYXBpL3Y1L3VzZXJzL2RlbW9naXRlZVwiLFxuXHRcImh0bWxfdXJsXCI6IFwiaHR0cHM6Ly9naXRlZS5jb20vZGVtb2dpdGVlXCIsXG5cdFwiZm9sbG93ZXJzX3VybFwiOiBcImh0dHBzOi8vZ2l0ZWUuY29tL2FwaS92NS91c2Vycy9kZW1vZ2l0ZWUvZm9sbG93ZXJzXCIsXG5cdFwiZm9sbG93aW5nX3VybFwiOiBcImh0dHBzOi8vZ2l0ZWUuY29tL2FwaS92NS91c2Vycy9kZW1vZ2l0ZWUvZm9sbG93aW5nX3VybHsvb3RoZXJfdXNlcn1cIixcblx0XCJnaXN0c191cmxcIjogXCJodHRwczovL2dpdGVlLmNvbS9hcGkvdjUvdXNlcnMvZGVtb2dpdGVlL2dpc3Rzey9naXN0X2lkfVwiLFxuXHRcInN0YXJyZWRfdXJsXCI6IFwiaHR0cHM6Ly9naXRlZS5jb20vYXBpL3Y1L3VzZXJzL2RlbW9naXRlZS9zdGFycmVkey9vd25lcn17L3JlcG99XCIsXG5cdFwic3Vic2NyaXB0aW9uc191cmxcIjogXCJodHRwczovL2dpdGVlLmNvbS9hcGkvdjUvdXNlcnMvZGVtb2dpdGVlL3N1YnNjcmlwdGlvbnNcIixcblx0XCJvcmdhbml6YXRpb25zX3VybFwiOiBcImh0dHBzOi8vZ2l0ZWUuY29tL2FwaS92NS91c2Vycy9kZW1vZ2l0ZWUvb3Jnc1wiLFxuXHRcInJlcG9zX3VybFwiOiBcImh0dHBzOi8vZ2l0ZWUuY29tL2FwaS92NS91c2Vycy9kZW1vZ2l0ZWUvcmVwb3NcIixcblx0XCJldmVudHNfdXJsXCI6IFwiaHR0cHM6Ly9naXRlZS5jb20vYXBpL3Y1L3VzZXJzL2RlbW9naXRlZS9ldmVudHN7L3ByaXZhY3l9XCIsXG5cdFwicmVjZWl2ZWRfZXZlbnRzX3VybFwiOiBcImh0dHBzOi8vZ2l0ZWUuY29tL2FwaS92NS91c2Vycy9kZW1vZ2l0ZWUvcmVjZWl2ZWRfZXZlbnRzXCIsXG5cdFwidHlwZVwiOiBcIlVzZXJcIixcblx0XCJzaXRlX2FkbWluXCI6IGZhbHNlLFxuXHRcImJsb2dcIjogbnVsbCxcblx0XCJ3ZWlib1wiOiBudWxsLFxuXHRcImJpb1wiOiBudWxsLFxuXHRcInB1YmxpY19yZXBvc1wiOiAyLFxuXHRcInB1YmxpY19naXN0c1wiOiAwLFxuXHRcImZvbGxvd2Vyc1wiOiAyMyxcblx0XCJmb2xsb3dpbmdcIjogMCxcblx0XCJzdGFyZWRcIjogMCxcblx0XCJ3YXRjaGVkXCI6IDMsXG5cdFwiY3JlYXRlZF9hdFwiOiBcIjIwMTctMTItMjZUMjE6MDE6MzMrMDg6MDBcIixcblx0XCJ1cGRhdGVkX2F0XCI6IFwiMjAxOS0wNS0yMlQwMDo0NjoxMiswODowMFwiLFxufVxuICovXG5leHBvcnQgaW50ZXJmYWNlIElVc2VyXG57XG5cdFwiaWRcIjogbnVtYmVyO1xuXHRcImxvZ2luXCI6IHN0cmluZztcblx0XCJuYW1lXCI6IHN0cmluZztcblx0XCJhdmF0YXJfdXJsXCI6IHN0cmluZztcblx0XCJ1cmxcIjogc3RyaW5nO1xuXHRcImh0bWxfdXJsXCI6IHN0cmluZztcblx0XCJmb2xsb3dlcnNfdXJsXCI6IHN0cmluZztcblx0XCJmb2xsb3dpbmdfdXJsXCI6IHN0cmluZztcblx0XCJnaXN0c191cmxcIjogc3RyaW5nO1xuXHRcInN0YXJyZWRfdXJsXCI6IHN0cmluZztcblx0XCJzdWJzY3JpcHRpb25zX3VybFwiOiBzdHJpbmc7XG5cdFwib3JnYW5pemF0aW9uc191cmxcIjogc3RyaW5nO1xuXHRcInJlcG9zX3VybFwiOiBzdHJpbmc7XG5cdFwiZXZlbnRzX3VybFwiOiBzdHJpbmc7XG5cdFwicmVjZWl2ZWRfZXZlbnRzX3VybFwiOiBzdHJpbmc7XG5cdFwidHlwZVwiOiBzdHJpbmc7XG5cdFwic2l0ZV9hZG1pblwiOiBib29sZWFuO1xuXHRcImJsb2dcIjogYW55O1xuXHRcIndlaWJvXCI6IGFueTtcblx0XCJiaW9cIjogYW55O1xuXHRcInB1YmxpY19yZXBvc1wiOiBudW1iZXI7XG5cdFwicHVibGljX2dpc3RzXCI6IG51bWJlcjtcblx0XCJmb2xsb3dlcnNcIjogbnVtYmVyO1xuXHRcImZvbGxvd2luZ1wiOiBudW1iZXI7XG5cdFwic3RhcmVkXCI6IG51bWJlcjtcblx0XCJ3YXRjaGVkXCI6IG51bWJlcjtcblx0XCJjcmVhdGVkX2F0XCI6IHN0cmluZztcblx0XCJ1cGRhdGVkX2F0XCI6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSXNzdWVzXG57XG5cdFwiaWRcIjogbnVtYmVyO1xuXHRcInVybFwiOiBzdHJpbmc7XG5cdFwicmVwb3NpdG9yeV91cmxcIjogc3RyaW5nO1xuXHRcImxhYmVsc191cmxcIjogc3RyaW5nO1xuXHRcImNvbW1lbnRzX3VybFwiOiBzdHJpbmc7XG5cdFwiaHRtbF91cmxcIjogc3RyaW5nO1xuXHRcInBhcmVudF91cmxcIjogYW55O1xuXHRcIm51bWJlclwiOiBzdHJpbmc7XG5cdFwic3RhdGVcIjogc3RyaW5nO1xuXHRcInRpdGxlXCI6IHN0cmluZztcblx0XCJib2R5XCI6IHN0cmluZztcblx0XCJ1c2VyXCI6IHtcblx0XHRcImlkXCI6IG51bWJlcjtcblx0XHRcImxvZ2luXCI6IHN0cmluZztcblx0XHRcIm5hbWVcIjogc3RyaW5nO1xuXHRcdFwiYXZhdGFyX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJ1cmxcIjogc3RyaW5nO1xuXHRcdFwiaHRtbF91cmxcIjogc3RyaW5nO1xuXHRcdFwiZm9sbG93ZXJzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJmb2xsb3dpbmdfdXJsXCI6IHN0cmluZztcblx0XHRcImdpc3RzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJzdGFycmVkX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJzdWJzY3JpcHRpb25zX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJvcmdhbml6YXRpb25zX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJyZXBvc191cmxcIjogc3RyaW5nO1xuXHRcdFwiZXZlbnRzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJyZWNlaXZlZF9ldmVudHNfdXJsXCI6IHN0cmluZztcblx0XHRcInR5cGVcIjogc3RyaW5nO1xuXHRcdFwic2l0ZV9hZG1pblwiOiBib29sZWFuO1xuXHR9O1xuXHRcImxhYmVsc1wiOiBhbnlbXTtcblx0XCJhc3NpZ25lZVwiOiBhbnk7XG5cdFwiY29sbGFib3JhdG9yc1wiOiBhbnlbXTtcblx0XCJyZXBvc2l0b3J5XCI6IHtcblx0XHRcImlkXCI6IG51bWJlcjtcblx0XHRcImZ1bGxfbmFtZVwiOiBzdHJpbmc7XG5cdFx0XCJodW1hbl9uYW1lXCI6IHN0cmluZztcblx0XHRcInVybFwiOiBzdHJpbmc7XG5cdFx0XCJuYW1lc3BhY2VcIjoge1xuXHRcdFx0XCJpZFwiOiBudW1iZXI7XG5cdFx0XHRcInR5cGVcIjogc3RyaW5nO1xuXHRcdFx0XCJuYW1lXCI6IHN0cmluZztcblx0XHRcdFwicGF0aFwiOiBzdHJpbmc7XG5cdFx0XHRcImh0bWxfdXJsXCI6IHN0cmluZztcblx0XHR9O1xuXHRcdFwicGF0aFwiOiBzdHJpbmc7XG5cdFx0XCJuYW1lXCI6IHN0cmluZztcblx0XHRcIm93bmVyXCI6IHtcblx0XHRcdFwiaWRcIjogbnVtYmVyO1xuXHRcdFx0XCJsb2dpblwiOiBzdHJpbmc7XG5cdFx0XHRcIm5hbWVcIjogc3RyaW5nO1xuXHRcdFx0XCJhdmF0YXJfdXJsXCI6IHN0cmluZztcblx0XHRcdFwidXJsXCI6IHN0cmluZztcblx0XHRcdFwiaHRtbF91cmxcIjogc3RyaW5nO1xuXHRcdFx0XCJmb2xsb3dlcnNfdXJsXCI6IHN0cmluZztcblx0XHRcdFwiZm9sbG93aW5nX3VybFwiOiBzdHJpbmc7XG5cdFx0XHRcImdpc3RzX3VybFwiOiBzdHJpbmc7XG5cdFx0XHRcInN0YXJyZWRfdXJsXCI6IHN0cmluZztcblx0XHRcdFwic3Vic2NyaXB0aW9uc191cmxcIjogc3RyaW5nO1xuXHRcdFx0XCJvcmdhbml6YXRpb25zX3VybFwiOiBzdHJpbmc7XG5cdFx0XHRcInJlcG9zX3VybFwiOiBzdHJpbmc7XG5cdFx0XHRcImV2ZW50c191cmxcIjogc3RyaW5nO1xuXHRcdFx0XCJyZWNlaXZlZF9ldmVudHNfdXJsXCI6IHN0cmluZztcblx0XHRcdFwidHlwZVwiOiBzdHJpbmc7XG5cdFx0XHRcInNpdGVfYWRtaW5cIjogYm9vbGVhbjtcblx0XHR9O1xuXHRcdFwiZGVzY3JpcHRpb25cIjogc3RyaW5nO1xuXHRcdFwicHJpdmF0ZVwiOiBib29sZWFuO1xuXHRcdFwicHVibGljXCI6IGJvb2xlYW47XG5cdFx0XCJpbnRlcm5hbFwiOiBib29sZWFuO1xuXHRcdFwiZm9ya1wiOiBib29sZWFuO1xuXHRcdFwiaHRtbF91cmxcIjogc3RyaW5nO1xuXHRcdFwic3NoX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJmb3Jrc191cmxcIjogc3RyaW5nO1xuXHRcdFwia2V5c191cmxcIjogc3RyaW5nO1xuXHRcdFwiY29sbGFib3JhdG9yc191cmxcIjogc3RyaW5nO1xuXHRcdFwiaG9va3NfdXJsXCI6IHN0cmluZztcblx0XHRcImJyYW5jaGVzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJ0YWdzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJibG9ic191cmxcIjogc3RyaW5nO1xuXHRcdFwic3RhcmdhemVyc191cmxcIjogc3RyaW5nO1xuXHRcdFwiY29udHJpYnV0b3JzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJjb21taXRzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJjb21tZW50c191cmxcIjogc3RyaW5nO1xuXHRcdFwiaXNzdWVfY29tbWVudF91cmxcIjogc3RyaW5nO1xuXHRcdFwiaXNzdWVzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJwdWxsc191cmxcIjogc3RyaW5nO1xuXHRcdFwibWlsZXN0b25lc191cmxcIjogc3RyaW5nO1xuXHRcdFwibm90aWZpY2F0aW9uc191cmxcIjogc3RyaW5nO1xuXHRcdFwibGFiZWxzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJyZWxlYXNlc191cmxcIjogc3RyaW5nO1xuXHRcdFwicmVjb21tZW5kXCI6IGJvb2xlYW47XG5cdFx0XCJob21lcGFnZVwiOiBhbnk7XG5cdFx0XCJsYW5ndWFnZVwiOiBzdHJpbmc7XG5cdFx0XCJmb3Jrc19jb3VudFwiOiBudW1iZXI7XG5cdFx0XCJzdGFyZ2F6ZXJzX2NvdW50XCI6IG51bWJlcjtcblx0XHRcIndhdGNoZXJzX2NvdW50XCI6IG51bWJlcjtcblx0XHRcImRlZmF1bHRfYnJhbmNoXCI6IHN0cmluZztcblx0XHRcIm9wZW5faXNzdWVzX2NvdW50XCI6IG51bWJlcjtcblx0XHRcImhhc19pc3N1ZXNcIjogYm9vbGVhbjtcblx0XHRcImhhc193aWtpXCI6IGJvb2xlYW47XG5cdFx0XCJwdWxsX3JlcXVlc3RzX2VuYWJsZWRcIjogYm9vbGVhbjtcblx0XHRcImhhc19wYWdlXCI6IGJvb2xlYW47XG5cdFx0XCJsaWNlbnNlXCI6IGFueTtcblx0XHRcIm91dHNvdXJjZWRcIjogYm9vbGVhbjtcblx0XHRcInByb2plY3RfY3JlYXRvclwiOiBzdHJpbmc7XG5cdFx0XCJtZW1iZXJzXCI6IHN0cmluZ1tdO1xuXHRcdFwicHVzaGVkX2F0XCI6IHN0cmluZztcblx0XHRcImNyZWF0ZWRfYXRcIjogc3RyaW5nO1xuXHRcdFwidXBkYXRlZF9hdFwiOiBzdHJpbmc7XG5cdFx0XCJwYXJlbnRcIjogYW55O1xuXHRcdFwicGFhc1wiOiBhbnk7XG5cdH07XG5cdFwibWlsZXN0b25lXCI6IGFueTtcblx0XCJjcmVhdGVkX2F0XCI6IHN0cmluZztcblx0XCJ1cGRhdGVkX2F0XCI6IHN0cmluZztcblx0XCJwbGFuX3N0YXJ0ZWRfYXRcIjogYW55O1xuXHRcImRlYWRsaW5lXCI6IGFueTtcblx0XCJmaW5pc2hlZF9hdFwiOiBhbnk7XG5cdFwic2NoZWR1bGVkX3RpbWVcIjogbnVtYmVyO1xuXHRcImNvbW1lbnRzXCI6IG51bWJlcjtcblx0XCJpc3N1ZV90eXBlXCI6IHN0cmluZztcblx0XCJwcm9ncmFtXCI6IGFueTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZUF2YXRhcihhdmF0YXI6IHN0cmluZylcbntcblx0cmV0dXJuIGF2YXRhclxufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplVXNlcih1c2VyOiBJVXNlciB8IElDb21tZW50W1widXNlclwiXSk6IFZzc3VlQVBJLlVzZXJcbntcblx0cmV0dXJuIHtcblx0XHR1c2VybmFtZTogdXNlci5sb2dpbixcblx0XHRhdmF0YXI6IGhhbmRsZUF2YXRhcih1c2VyLmF2YXRhcl91cmwpLFxuXHRcdGhvbWVwYWdlOiB1c2VyLmh0bWxfdXJsLFxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVJc3N1ZShpc3N1ZTogSUlzc3Vlcyk6IFZzc3VlQVBJLklzc3VlXG57XG5cdHJldHVybiB7XG5cdFx0aWQ6IGlzc3VlLm51bWJlcixcblx0XHR0aXRsZTogaXNzdWUudGl0bGUsXG5cdFx0Y29udGVudDogaXNzdWUuYm9keSxcblx0XHRsaW5rOiBpc3N1ZS51cmwsXG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbWVudFxue1xuXHRcImlkXCI6IG51bWJlcjtcblx0XCJib2R5XCI6IHN0cmluZztcblx0XCJ1c2VyXCI6IHtcblx0XHRcImlkXCI6IG51bWJlcjtcblx0XHRcImxvZ2luXCI6IHN0cmluZztcblx0XHRcIm5hbWVcIjogc3RyaW5nO1xuXHRcdFwiYXZhdGFyX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJ1cmxcIjogc3RyaW5nO1xuXHRcdFwiaHRtbF91cmxcIjogc3RyaW5nO1xuXHRcdFwiZm9sbG93ZXJzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJmb2xsb3dpbmdfdXJsXCI6IHN0cmluZztcblx0XHRcImdpc3RzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJzdGFycmVkX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJzdWJzY3JpcHRpb25zX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJvcmdhbml6YXRpb25zX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJyZXBvc191cmxcIjogc3RyaW5nO1xuXHRcdFwiZXZlbnRzX3VybFwiOiBzdHJpbmc7XG5cdFx0XCJyZWNlaXZlZF9ldmVudHNfdXJsXCI6IHN0cmluZztcblx0XHRcInR5cGVcIjogc3RyaW5nO1xuXHRcdFwic2l0ZV9hZG1pblwiOiBib29sZWFuO1xuXHR9O1xuXHRcInNvdXJjZVwiOiBzdHJpbmc7XG5cdFwiY3JlYXRlZF9hdFwiOiBzdHJpbmc7XG5cdFwidGFyZ2V0XCI6IHtcblx0XHRcImlzc3VlXCI6IHtcblx0XHRcdFwiaWRcIjogbnVtYmVyO1xuXHRcdFx0XCJudW1iZXJcIjogc3RyaW5nO1xuXHRcdFx0XCJ0aXRsZVwiOiBzdHJpbmc7XG5cdFx0fTtcblx0XHRcInB1bGxfcmVxdWVzdFwiOiBhbnk7XG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVDb21tZW50KGNvbW1lbnQ6IElDb21tZW50KTogVnNzdWVBUEkuQ29tbWVudFxue1xuXHRjb25zb2xlLmxvZyhtZC5yZW5kZXIoY29tbWVudC5ib2R5KSk7XG5cblx0cmV0dXJuIHtcblx0XHRpZDogY29tbWVudC5pZCBhcyBhbnksXG5cdFx0Y29udGVudDogbWQucmVuZGVyKGNvbW1lbnQuYm9keSksXG5cdFx0Y29udGVudFJhdzogY29tbWVudC5ib2R5LFxuXHRcdGF1dGhvcjogbm9ybWFsaXplVXNlcihjb21tZW50LnVzZXIpLFxuXHRcdGNyZWF0ZWRBdDogY29tbWVudC5jcmVhdGVkX2F0LFxuXHRcdHVwZGF0ZWRBdDogY29tbWVudC5jcmVhdGVkX2F0LFxuXHRcdC8vcmVhY3Rpb25zOiBub3JtYWxpemVSZWFjdGlvbnMoY29tbWVudC5yZWFjdGlvbkdyb3VwcyksXG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVJlYWN0aW9ucyhyZWFjdGlvbnM6IGFueSk6IFZzc3VlQVBJLlJlYWN0aW9uc1xue1xuXHRyZXR1cm4ge1xuXHRcdGxpa2U6IHJlYWN0aW9ucy5maW5kKGl0ZW0gPT4gaXRlbS5jb250ZW50ID09PSAnVEhVTUJTX1VQJykudXNlcnMudG90YWxDb3VudCxcblx0XHR1bmxpa2U6IHJlYWN0aW9ucy5maW5kKGl0ZW0gPT4gaXRlbS5jb250ZW50ID09PSAnVEhVTUJTX0RPV04nKS51c2Vycy50b3RhbENvdW50LFxuXHRcdGhlYXJ0OiByZWFjdGlvbnMuZmluZChpdGVtID0+IGl0ZW0uY29udGVudCA9PT0gJ0hFQVJUJykudXNlcnMudG90YWxDb3VudCxcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbWFwUmVhY3Rpb25OYW1lKHJlYWN0aW9uOiBrZXlvZiBWc3N1ZUFQSS5SZWFjdGlvbnMpOiBzdHJpbmdcbntcblx0aWYgKHJlYWN0aW9uID09PSAnbGlrZScpIHJldHVybiAnVEhVTUJTX1VQJ1xuXHRpZiAocmVhY3Rpb24gPT09ICd1bmxpa2UnKSByZXR1cm4gJ1RIVU1CU19ET1dOJ1xuXHRpZiAocmVhY3Rpb24gPT09ICdoZWFydCcpIHJldHVybiAnSEVBUlQnXG5cdHJldHVybiByZWFjdGlvblxufVxuXG5leHBvcnQgZGVmYXVsdCB7XG5cdG5vcm1hbGl6ZVVzZXIsXG5cdG5vcm1hbGl6ZUlzc3VlLFxuXHRub3JtYWxpemVDb21tZW50LFxuXHRub3JtYWxpemVSZWFjdGlvbnMsXG5cdG1hcFJlYWN0aW9uTmFtZSxcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gRW51bU15Q29uc3Rcbntcblx0U0lURV9OQU1FID0gJ0dpdGVlJyxcblx0QkFTRV9VUkwgPSAnaHR0cHM6Ly9naXRlZS5jb20nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dQYXJhbVR5cGVzKHRhcmdldDogYW55LCBrZXk6IHN0cmluZylcbntcblx0bGV0IHR5cGVzID0gUmVmbGVjdC5nZXRNZXRhZGF0YShcImRlc2lnbjpwYXJhbXR5cGVzXCIsIHRhcmdldCwga2V5KTtcblx0bGV0IHMgPSB0eXBlcy5tYXAoYSA9PiBhLm5hbWUpLmpvaW4oKTtcblx0Y29uc29sZS5sb2coYCR7a2V5fSBwYXJhbSB0eXBlczogJHtzfWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9nUGFyYW1ldGVyKHRhcmdldDogYW55LCBrZXk6IHN0cmluZywgaW5kZXg6IG51bWJlcilcbntcblx0bGV0IG1ldGFkYXRhS2V5ID0gYF9fbG9nXyR7a2V5fV9wYXJhbWV0ZXJzYDtcblx0aWYgKEFycmF5LmlzQXJyYXkodGFyZ2V0W21ldGFkYXRhS2V5XSkpXG5cdHtcblx0XHR0YXJnZXRbbWV0YWRhdGFLZXldLnB1c2goaW5kZXgpO1xuXHR9XG5cdGVsc2Vcblx0e1xuXHRcdHRhcmdldFttZXRhZGF0YUtleV0gPSBbaW5kZXhdO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dNZXRob2QodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpXG57XG5cblx0aWYgKGRlc2NyaXB0b3IgPT09IHVuZGVmaW5lZClcblx0e1xuXHRcdGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KTtcblx0fVxuXHRsZXQgb3JpZ2luYWxNZXRob2QgPSBkZXNjcmlwdG9yLnZhbHVlO1xuXG5cdC8vZWRpdGluZyB0aGUgZGVzY3JpcHRvci92YWx1ZSBwYXJhbWV0ZXJcblx0ZGVzY3JpcHRvci52YWx1ZSA9IGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSlcblx0e1xuXG5cdFx0bGV0IG1ldGFkYXRhS2V5ID0gYF9fbG9nXyR7a2V5fV9wYXJhbWV0ZXJzYDtcblx0XHRsZXQgaW5kaWNlcyA9IHRhcmdldFttZXRhZGF0YUtleV07XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShpbmRpY2VzKSlcblx0XHR7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspXG5cdFx0XHR7XG5cblx0XHRcdFx0aWYgKGluZGljZXMuaW5kZXhPZihpKSAhPT0gLTEpXG5cdFx0XHRcdHtcblxuXHRcdFx0XHRcdGxldCBhcmcgPSBhcmdzW2ldO1xuXHRcdFx0XHRcdGxldCBhcmdTdHIgPSBKU09OLnN0cmluZ2lmeShhcmcpIHx8IGFyZy50b1N0cmluZygpO1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGAke2tleX0gYXJnWyR7aX1dOiAke2FyZ1N0cn1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bGV0IHJlc3VsdCA9IG9yaWdpbmFsTWV0aG9kLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0ZWxzZVxuXHRcdHtcblxuXHRcdFx0bGV0IGEgPSBhcmdzLm1hcChhID0+IChpbnNwZWN0KGEsIHtcblx0XHRcdFx0c2hvd0hpZGRlbjogdHJ1ZSxcblx0XHRcdH0pKSk7XG5cdFx0XHRsZXQgcmVzdWx0ID0gb3JpZ2luYWxNZXRob2QuYXBwbHkodGhpcywgYXJncyk7XG5cblx0XHRcdGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKVxuXHRcdFx0e1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0XG5cdFx0XHRcdFx0LnRoZW4ocmVzdWx0ID0+XG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV0IHIgPSBpbnNwZWN0KHJlc3VsdCwgaW5zcGVjdE9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYENhbGw6ICR7a2V5fVxcbigke2F9KVxcbj0+IFByb21pc2UoJHtyfSlgKTtcblx0XHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQuY2F0Y2goZSA9PlxuXHRcdFx0XHRcdHtcblxuXHRcdFx0XHRcdFx0bGV0IHIgPSBpbnNwZWN0KGUsIGluc3BlY3RPcHRpb25zKTtcblxuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihgQ2FsbCBGYWlsZWQ6ICR7a2V5fVxcbigke2F9KVxcbj0+IFByb21pc2UoJHtyfSlgKTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGUpXG5cdFx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHRcdGVsc2Vcblx0XHRcdHtcblx0XHRcdFx0bGV0IHIgPSBpbnNwZWN0KHJlc3VsdCwgaW5zcGVjdE9wdGlvbnMpO1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgQ2FsbDogJHtrZXl9XFxuKCR7YX0pXFxuPT4gJHtyfWApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fVxuXG5cdC8vIHJldHVybiBlZGl0ZWQgZGVzY3JpcHRvciBhcyBvcHBvc2VkIHRvIG92ZXJ3cml0aW5nIHRoZSBkZXNjcmlwdG9yXG5cdHJldHVybiBkZXNjcmlwdG9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm90aWNlRXJyb3IodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpXG57XG5cdGlmIChkZXNjcmlwdG9yID09PSB1bmRlZmluZWQpXG5cdHtcblx0XHRkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSk7XG5cdH1cblx0bGV0IG9yaWdpbmFsTWV0aG9kID0gZGVzY3JpcHRvci52YWx1ZTtcblxuXHRkZXNjcmlwdG9yLnZhbHVlID0gZnVuY3Rpb24gKC4uLmFyZ3M6IGFueVtdKVxuXHR7XG5cdFx0bGV0IHJlc3VsdDtcblx0XHR0cnlcblx0XHR7XG5cdFx0XHRyZXN1bHQgPSBvcmlnaW5hbE1ldGhvZC5hcHBseSh0aGlzLCBhcmdzKTtcblxuXHRcdFx0aWYgKHJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpXG5cdFx0XHR7XG5cdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5jYXRjaCgoZTogQXhpb3NFcnJvcikgPT5cblx0XHRcdFx0e1xuXG5cdFx0XHRcdFx0bm90aWNlQXhpb3NFcnJvcihlKTtcblxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChlKVxuXHRcdFx0XHR9KVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjYXRjaCAoZSlcblx0XHR7XG5cdFx0XHRub3RpY2VBeGlvc0Vycm9yKGUpXG5cdFx0XHR0aHJvdyBlXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdFxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3RpY2VBeGlvc0Vycm9yKGU6IEF4aW9zRXJyb3IgJiB7XG5cdG5vdGljZWQ/OiBib29sZWFuO1xufSlcbntcblx0aWYgKGUgJiYgIWUubm90aWNlZCAmJiBlLnJlc3BvbnNlICYmIGUucmVzcG9uc2UuZGF0YSlcblx0e1xuXHRcdGUubm90aWNlZCA9IHRydWU7XG5cblx0XHRzZXRUaW1lb3V0KCgpID0+XG5cdFx0e1xuXHRcdFx0d2luZG93LmFsZXJ0KGAke2UubWVzc2FnZX1cXG4ke2luc3BlY3QoZS5yZXNwb25zZS5kYXRhKX1gKTtcblx0XHR9LCAxMDApO1xuXHR9XG59XG4iXX0=