async function getWeatherData() {
    // 松本のIDで許してやる
    const url = "https://weather.tsukumijima.net/api/forecast/city/200020";
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`エラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(data);
        
        // HTMLに表示（松本地域の天気として）
        document.getElementById('city-name').textContent = data.title + '';
        document.getElementById('today-weather').textContent = data.forecasts[0].telop;
        
    } catch (error) {
        console.error('エラーが発生しました:', error);
        document.getElementById('city-name').textContent = 'エラーが発生しました';
    }
}

getWeatherData();

