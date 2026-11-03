(function (root) {
    'use strict';
    var festivals = [
        {key:'valentine',name:'情人节',month:2,day:14},
        {key:'qixi',name:'七夕',month:7,day:7,lunar:true},
        {key:'new_year',name:'元旦',month:1,day:1},
        {key:'spring',name:'春节',month:1,day:1,lunar:true},
        {key:'lantern',name:'元宵节',month:1,day:15,lunar:true},
        {key:'dragon_boat',name:'端午节',month:5,day:5,lunar:true},
        {key:'mid_autumn',name:'中秋节',month:8,day:15,lunar:true},
        {key:'national',name:'国庆节',month:10,day:1},
        {key:'christmas',name:'圣诞节',month:12,day:25},
        {key:'love520',name:'520',month:5,day:20}
    ];
    var cache = {}, formatter;
    function iso(date) {
        return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
    }
    function dayNumber(date) {return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000;}
    function annual(year, month, day) {return new Date(year,month-1,Math.min(day,new Date(year,month,0).getDate()));}
    function keyOf(row) {
        if(row.festival_key) return row.festival_key;
        if((row.kind || row.category)!=='festival') return '';
        var match=festivals.find(function(f){return f.name===(row.title || row.name);});
        return match ? match.key : '';
    }
    function occurrence(festival,year) {
        if(!festival.lunar) return annual(year,festival.month,festival.day);
        var key=festival.key+':'+year;
        if(Object.prototype.hasOwnProperty.call(cache,key)) return cache[key];
        try {
            formatter=formatter || new Intl.DateTimeFormat('en-u-ca-chinese',{month:'numeric',day:'numeric'});
            if(formatter.resolvedOptions().calendar!=='chinese') throw new Error('Chinese calendar unavailable');
            for(var date=new Date(year,0,1); date.getFullYear()===year; date.setDate(date.getDate()+1)) {
                var parts=formatter.formatToParts(date), month='', day='';
                parts.forEach(function(part){if(part.type==='month')month=part.value;if(part.type==='day')day=part.value;});
                // Intl marks leap months with a suffix; festivals use the regular month.
                if(month===String(festival.month) && day===String(festival.day)) return cache[key]=new Date(date);
            }
        } catch(error) {return cache[key]=null;}
        return cache[key]=null;
    }
    function next(row,now) {
        now=now || new Date();
        var today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
        var key=keyOf(row), festival=festivals.find(function(f){return f.key===key;});
        if(festival) {
            for(var year=today.getFullYear();year<=today.getFullYear()+2;year++) {
                var date=occurrence(festival,year);
                if(date && date>=today) return date;
            }
            return null;
        }
        var value=row.target_date || row.targetDate;
        if((row.kind || row.category)==='birthday' && row.birthday_calendar==='lunar') {
            try {var lunarNext=root.BirthdayCalendar.find(value,today,false);return lunarNext ? lunarNext.date : null;}
            catch(error) {return null;}
        }
        if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
        var original=new Date(value+'T00:00:00');
        if(isNaN(original.getTime())) return null;
        if((row.kind || row.category)==='countdown') return original;
        var target=annual(today.getFullYear(),original.getMonth()+1,original.getDate());
        if(target<today) target=annual(today.getFullYear()+1,original.getMonth()+1,original.getDate());
        if((row.kind || row.category)==='birthday' && target<original) target=original;
        return target;
    }
    function previous(row,now) {
        now=now || new Date();
        var today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
        if((row.kind || row.category)==='birthday' && row.birthday_calendar==='lunar') {
            try {var lunarPrevious=root.BirthdayCalendar.find(row.target_date || row.targetDate,today,true);return lunarPrevious ? lunarPrevious.date : null;}
            catch(error) {return null;}
        }
        if((row.kind || row.category)==='countdown') return null;
        var festival=festivals.find(function(f){return f.key===keyOf(row);});
        if(festival) {
            for(var year=today.getFullYear();year>=today.getFullYear()-2;year--) {
                var date=occurrence(festival,year);
                if(date && date<today) return date;
            }
            return null;
        }
        var target=next(row,today);
        if(!target) return null;
        var value=row.target_date || row.targetDate;
        var original=new Date(value+'T00:00:00');
        return annual(target.getFullYear()-1,original.getMonth()+1,original.getDate());
    }
    function describe(row,now) {
        now=now || new Date();
        var target=next(row,now);
        if(!target) return {label:'当前浏览器不支持农历计算',next_date:'',age:null};
        var days=dayNumber(target)-dayNumber(now);
        var age=null;
        if((row.kind || row.category)==='birthday') {
            age=row.birthday_calendar==='lunar' ? root.BirthdayCalendar.find(row.target_date || row.targetDate,now,false).age : target.getFullYear()-Number((row.target_date || row.targetDate).slice(0,4));
        }
        return {label:days===0?'就是今天！':days>0?days+' 天':'已过 '+Math.abs(days)+' 天',next_date:iso(target),age:age};
    }
    root.ImportantDays={festivals:festivals,keyOf:keyOf,next:next,previous:previous,describe:describe,occurrence:occurrence,iso:iso};
})(typeof window==='undefined'?globalThis:window);
