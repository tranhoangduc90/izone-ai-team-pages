// Giữ link đã gửi trước đây nhưng chỉ còn một dashboard tại URL cũ.
const target=new URL('./',location.href);
target.search=location.search;
target.hash=location.hash;
location.replace(target.href);
