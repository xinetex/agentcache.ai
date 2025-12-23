' Audio1.TV CDN Client for Roku (BrightScript)
' 
' Usage:
' cdn = Audio1CDN("https://agentcache.ai")
' streamUrl = cdn.getPlaylistUrl("video-123", "720p")
' 
' videoContent = createObject("roAssociatedArray")
' videoContent.url = streamUrl
' videoContent.streamFormat = "hls"

function Audio1CDN(baseUrl as String) as Object
    cdn = {
        baseUrl: baseUrl
        
        ' Get HLS playlist URL
        getPlaylistUrl: function(jobId as String, quality = "720p" as String) as String
            return m.baseUrl + "/hls/" + jobId + "/" + quality + "/playlist.m3u8"
        end function
        
        ' Get master playlist for adaptive streaming
        getMasterPlaylistUrl: function(jobId as String) as String
            return m.baseUrl + "/hls/" + jobId + "/master.m3u8"
        end function
        
        ' Get segment URL
        getSegmentUrl: function(jobId as String, quality as String, segment as String) as String
            return m.baseUrl + "/hls/" + jobId + "/" + quality + "/" + segment
        end function
        
        ' Create video content object for Roku player
        createVideoContent: function(jobId as String, quality = "720p" as String, title = "" as String) as Object
            content = createObject("roAssociatedArray")
            content.url = m.getPlaylistUrl(jobId, quality)
            content.streamFormat = "hls"
            content.title = title
            content.playStart = 0
            return content
        end function
        
        ' Create adaptive video content with multiple quality levels
        createAdaptiveVideoContent: function(jobId as String, title = "" as String) as Object
            content = createObject("roAssociatedArray")
            content.url = m.getMasterPlaylistUrl(jobId)
            content.streamFormat = "hls"
            content.title = title
            content.playStart = 0
            content.adaptiveMinStartBitrate = 0
            content.adaptiveMaxStartBitrate = 0  ' Let player decide
            return content
        end function
    }
    
    return cdn
end function

' Quality constants
function QualityPresets() as Object
    return {
        MOBILE: "360p"
        SD: "480p"
        HD: "720p"
        FULL_HD: "1080p"
    }
end function

' Detect optimal quality based on device capability
function detectOptimalQuality() as String
    deviceInfo = createObject("roDeviceInfo")
    model = deviceInfo.getModel()
    
    ' Roku 4K devices
    if model.instr("4K") > 0 or model.instr("Ultra") > 0 then
        return "1080p"
    end if
    
    ' Check display resolution
    displaySize = deviceInfo.getDisplaySize()
    if displaySize.w >= 1920 then
        return "1080p"
    else if displaySize.w >= 1280 then
        return "720p"
    else if displaySize.w >= 854 then
        return "480p"
    else
        return "360p"
    end if
end function

' Example: Play a video
' sub playVideo(videoId as String)
'     cdn = Audio1CDN("https://agentcache.ai")
'     quality = detectOptimalQuality()
'     
'     videoPlayer = createObject("roVideoPlayer")
'     port = createObject("roMessagePort")
'     videoPlayer.setMessagePort(port)
'     
'     content = cdn.createVideoContent(videoId, quality, "My Video")
'     videoPlayer.setContentList([content])
'     videoPlayer.play()
'     
'     while true
'         msg = wait(0, port)
'         if type(msg) = "roVideoPlayerEvent" then
'             if msg.isPlaybackPosition() then
'                 ' Handle playback position updates
'             else if msg.isFullResult() then
'                 exit while
'             else if msg.isRequestFailed() then
'                 print "Playback failed"
'                 exit while
'             end if
'         end if
'     end while
' end sub
