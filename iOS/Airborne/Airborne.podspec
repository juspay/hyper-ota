Pod::Spec.new do |s|
  s.name             = 'Airborne'
  s.version          = '0.1.0'
  s.summary          = 'An OTA update plugin for Android, iOS and React Native applications.'
  s.description      = <<-DESC
Hyper OTA empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their Android, iOS, and React Native applications. Our primary focus is to provide robust, easy-to-use SDKs and plugins that streamline the update process directly within your client applications.
                       DESC

  s.homepage         = 'https://github.com/juspay/airborne/iOS/Airborne'
  s.license          = { :type => 'Apache 2.0', :file => 'LICENSE' }
  s.author           = { 'yuvrajjsingh0' => 'yuvraj.singh@juspay.in' }
  
  s.source = {
    :git  => 'https://github.com/juspay/airborne.git',
    :tag  => s.version.to_s
  }

  s.source_files       = 'Airborne/Classes/**/*.{h,m}'
  s.public_header_files = 'Airborne/Classes/**/*.h'

  s.platform     = :ios, "12.0"
  
  s.dependency 'HyperOTA', '0.0.4'
  s.dependency 'HyperCore', '0.0.6'
end
